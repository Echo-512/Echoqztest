from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

from docx import Document


ROOT = Path(__file__).resolve().parents[1]
DOCX_PATH = Path(
    "/Users/zhaoxuan/Library/Containers/com.tencent.xinWeChat/Data/Documents/"
    "xwechat_files/wxid_649gsmd2mds132_d562/msg/file/2026-07/"
    "03、 B森『言语理解』【带解析462页】.docx"
)
OUTPUT_PATH = ROOT / "app/verbal-questions.json"
REVIEW_PATH = ROOT / "tmp/verbal-review.json"

ANSWER_RE = re.compile(r"^(?:正确答案|参考答案|答案)\s*[:：]\s*([A-H])\s*$")
ANALYSIS_RE = re.compile(r"^(?:解析|答案解析)\s*[:：]\s*(.*)$")
OPTION_RE = re.compile(r"^([A-H])\s*[:：.、]\s*(.*)$")
NUMBER_RE = re.compile(r"^\d{1,4}$")


@dataclass
class RawQuestion:
    occurrence: int
    prompt: str
    options: list[str]
    answer: str
    source_analysis: str


def clean_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    value = re.sub(r"<br\s*/?>", " ", value, flags=re.IGNORECASE)
    value = value.replace("&nbsp;", " ").replace("\u00a0", " ").replace("\u3000", " ")
    return re.sub(r"\s+", " ", value).strip()


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).lower()
    return re.sub(r"[^a-z0-9\u3400-\u9fff]+", "", value)


def read_paragraphs() -> list[str]:
    return [clean_text(paragraph.text) for paragraph in Document(DOCX_PATH).paragraphs]


def strip_previous_analysis(block: list[str]) -> list[str]:
    while block and not block[0]:
        block.pop(0)
    had_analysis = bool(block and ANALYSIS_RE.match(block[0]))
    if had_analysis:
        block.pop(0)
    if had_analysis:
        continuation_re = re.compile(
            r"^(?:[A-H]\s*项|第[一二三四]步|故(?:正确)?答案|"
            r"所以答案|因此答案|综上|由此可知)"
        )

        def is_dictionary_continuation(value: str) -> bool:
            return bool(
                len(value) < 100
                and re.match(r"^[\u3400-\u9fff]{2,10}\s*[:：]", value)
                and not re.search(
                    r"根据|回答|下列|以下|这段|填入|哪|什么|为何|为什么|"
                    r"最恰当|最合适|_{2,}|[?？]",
                    value,
                )
            )

        while len(block) > 1 and (
            continuation_re.match(block[0]) or is_dictionary_continuation(block[0])
        ):
            block.pop(0)
    while block and not block[0]:
        block.pop(0)
    return block


def parse_questions(paragraphs: list[str]) -> list[RawQuestion]:
    answer_positions: list[tuple[int, str]] = []
    for index, paragraph in enumerate(paragraphs):
        match = ANSWER_RE.match(paragraph)
        if match:
            answer_positions.append((index, match.group(1)))

    questions: list[RawQuestion] = []
    previous_answer = 1
    for occurrence, (answer_index, answer) in enumerate(answer_positions, start=1):
        block = strip_previous_analysis(
            [paragraph for paragraph in paragraphs[previous_answer:answer_index] if paragraph]
        )
        while block and NUMBER_RE.fullmatch(block[0]):
            block.pop(0)

        option_start = next(
            (
                index
                for index, paragraph in enumerate(block)
                if (match := OPTION_RE.match(paragraph)) and match.group(1) == "A"
            ),
            None,
        )
        if option_start is None:
            raise ValueError(f"第 {occurrence} 个答案前未识别到 A 选项")

        prompt = clean_text(" ".join(block[:option_start]))
        options: list[tuple[str, str]] = []
        current_letter = ""
        current_text = ""
        for paragraph in block[option_start:]:
            match = OPTION_RE.match(paragraph)
            if match:
                if current_letter:
                    options.append((current_letter, clean_text(current_text)))
                current_letter = match.group(1)
                current_text = match.group(2)
            elif current_letter:
                current_text = f"{current_text} {paragraph}"
        if current_letter:
            options.append((current_letter, clean_text(current_text)))

        letters = [letter for letter, _ in options]
        expected = [chr(65 + index) for index in range(len(options))]
        if letters != expected:
            raise ValueError(
                f"源题 {occurrence} 选项字母不连续：{letters}，预期 {expected}"
            )
        if answer not in letters:
            raise ValueError(
                f"源题 {occurrence} 正确答案 {answer} 超出选项 {letters}"
            )

        source_analysis = ""
        next_index = answer_index + 1
        while next_index < len(paragraphs) and not paragraphs[next_index]:
            next_index += 1
        if next_index < len(paragraphs):
            match = ANALYSIS_RE.match(paragraphs[next_index])
            if match:
                source_analysis = clean_text(match.group(1))

        questions.append(
            RawQuestion(
                occurrence=occurrence,
                prompt=prompt,
                options=[text for _, text in options],
                answer=answer,
                source_analysis=source_analysis,
            )
        )
        previous_answer = answer_index + 1
    return questions


def deduplicate(questions: list[RawQuestion]) -> tuple[list[RawQuestion], dict[int, list[int]]]:
    groups: dict[str, list[RawQuestion]] = defaultdict(list)
    for question in questions:
        groups[normalize(question.prompt)].append(question)

    chosen: list[RawQuestion] = []
    duplicate_map: dict[int, list[int]] = {}
    for group in groups.values():
        # Prefer the occurrence with a real source explanation, then the more
        # complete option set. Source order is the final tie-break.
        question = max(
            group,
            key=lambda item: (
                bool(item.source_analysis),
                len(item.source_analysis),
                len(item.options),
                -item.occurrence,
            ),
        )
        chosen.append(question)
        if len(group) > 1:
            duplicate_map[question.occurrence] = [
                item.occurrence for item in group if item.occurrence != question.occurrence
            ]
    chosen.sort(key=lambda item: item.occurrence)
    return chosen, duplicate_map


def is_negative_prompt(prompt: str) -> bool:
    return bool(
        re.search(
            r"不正确|错误的是|不准确|不恰当|不相符|没有提及|未提及|不能推出|"
            r"不属于|无法推出|不符合",
            prompt,
        )
    )


def looks_like_logic_fill(prompt: str, options: list[str]) -> bool:
    marker = bool(
        re.search(
            r"依次填入|填入.{0,12}(?:词语|成语)|最适合填入|最恰当的词|"
            r"填入横线|填入空格|填入括号",
            prompt,
        )
    )
    if not marker:
        return False
    average_length = sum(len(option) for option in options) / max(len(options), 1)
    return average_length <= 18 or "词语" in prompt or "成语" in prompt


def looks_like_sentence_fill(prompt: str, options: list[str]) -> bool:
    if not re.search(r"填入|横线|空格|衔接|_{2,}", prompt):
        return False
    average_length = sum(len(option) for option in options) / max(len(options), 1)
    return average_length > 18 or bool(
        re.search(r"填入.{0,12}(?:语句|句子)|衔接最恰当", prompt)
    )


def looks_like_formal_logic(prompt: str) -> bool:
    return bool(
        re.search(
            r"削弱|加强|最能支持|最能反驳|以下哪项.{0,12}(?:支持|反驳)|"
            r"假设条件|前提是|"
            r"推理方法|论证方式|只有一个是真的|必定为真|一定是事实|"
            r"以下哪项陈述为真.{0,8}最能|据此.{0,4}推出",
            prompt,
        )
    )


def classify_category(question: RawQuestion) -> str:
    prompt = question.prompt
    if re.search(r"最适合.{0,8}标题|最适合.{0,8}题目|用作.{0,8}题目|标题是|标题为", prompt):
        return "标题填入题"
    if re.search(r"接下来|下文.{0,10}(?:讲述|介绍|论述|说明)|接着.{0,8}(?:讲|写)", prompt):
        return "接语推断题"
    if re.search(
        r"排列顺序|排序最|组成一段|组成一句|重新排列|语序正确|"
        r"句子排列顺序|句子重新排列",
        prompt,
    ):
        return "语句排序题"
    if looks_like_formal_logic(prompt):
        return "其他文字推理"
    if looks_like_logic_fill(prompt, question.options):
        return "逻辑填空"
    if looks_like_sentence_fill(prompt, question.options):
        return "语句填空题"
    if re.search(r"病句|语病|歧义|句意明确|表达正确|没有语病", prompt):
        return "其他文字推理"
    if re.search(r"正确选项为|词项间关系|逻辑关系最为相似", prompt) and len(prompt) < 90:
        return "其他文字推理"
    if re.search(
        r"(?:词语|句子|划线|画线|加点|文中|上下文).{0,18}"
        r"(?:指代|指的是|含义|意思|理解|解释)|"
        r"对[\"“][^\"”]+[\"”].{0,15}(?:理解|解释)",
        prompt,
    ):
        return "词句理解题"
    if re.search(
        r"下列.{0,12}(?:正确|错误|不正确|不准确|不恰当|相符|符合|没有提及|"
        r"未提及|可以推出|不能推出)|根据.{0,10}(?:可知|推断|推论)|"
        r"由材料.{0,8}(?:推论|推出)|通过这段话.{0,8}知道",
        prompt,
    ):
        return "细节判断题"
    if re.search(
        r"主旨|旨在|意在|主要(?:说明|阐述|介绍|讲述|表达|支持|内容)|"
        r"中心|核心意思|概括最|复述|谈论的是|观点是|重在说明",
        prompt,
    ):
        return "中心理解题"
    if re.search(r"为什么|原因是|动机是|表明|说明了|可以知道", prompt):
        return "细节判断题"
    return "中心理解题"


def title_point(prompt: str) -> str:
    if re.search(r"近日|日前|记者|报道|消息|月\d+日|召开|发布|举行|获悉", prompt):
        return "新闻类"
    if re.search(r"研究发现|是指|是一种|称为|科学家|其特点|主要包括|分为", prompt):
        return "说明文"
    if re.search(r"有一天|从前|故事|他(?:说|问|来到|看见)|她(?:说|问|来到|看见)", prompt):
        return "故事类"
    return "议论文"


def center_point(prompt: str) -> str:
    if re.search(r"只有.{0,80}才|除非|必须|应该|应当|需要|亟须|建议|呼吁|关键在于", prompt):
        return "做题辅助-对策词"
    if re.search(r"但是|然而|不过|却|其实|事实上|实际上|相反", prompt):
        return "关联词语-转折关系"
    if re.search(r"因此|所以|由此|因而|故而|正因如此", prompt):
        return "关联词语-因果关系"
    if re.search(r"不仅|不但|甚至|尤其|更为|特别是|最为", prompt):
        return "关联词语-递进关系"
    if re.search(r"此外|另外|同时|一方面.{0,160}另一方面|;|；", prompt):
        return "关联词语-并列关系"
    if len(prompt) > 360 and re.search(r"总之|可见|归根结底|这说明", prompt):
        return "行文脉络-分总"
    if len(prompt) > 360 and re.search(r"首先|其一|第一|例如|具体而言", prompt):
        return "行文脉络-总分"
    if len(prompt) > 520:
        return "行文脉络-分分"
    return "做题辅助-主题词"


def order_point(prompt: str) -> str:
    if re.search(r"后来|随后|起初|最初|先是|最终|年|时代|时期", prompt):
        return "集团顺序-时间顺序"
    if re.search(r"这里|那里|上方|下方|由外|由内|空间", prompt):
        return "集团顺序-空间顺序"
    if re.search(r"这|其|它|他|该|上述|由此", prompt):
        return "绑定集团-代词"
    if re.search(r"但是|然而|因此|所以|不仅|而且|一方面|另一方面", prompt):
        return "绑定集团-关联词语"
    if re.search(r"总之|因此|可见|最终", prompt):
        return "确定结尾"
    return "确定开头"


def blank_position(prompt: str) -> str:
    matches = list(re.finditer(r"_{2,}|（\s*）|\(\s*\)", prompt))
    if not matches:
        return "特殊类"
    position = matches[-1].start() / max(len(prompt), 1)
    if position < 0.25:
        return "横线在段首"
    if position > 0.72:
        return "横线在段尾"
    return "横线在段中"


def logic_fill_point(prompt: str, options: list[str]) -> str:
    if re.search(r"不仅|不但|甚至|尤其|更为|特别是", prompt):
        return "题干逻辑-递进关系"
    if re.search(r"但是|然而|不过|却|虽然|尽管", prompt):
        return "题干逻辑-转折关系"
    if re.search(r"此外|另外|同时|一方面|另一方面|以及|并且", prompt):
        return "题干逻辑-并列关系"
    if re.search(r"也就是说|换言之|即|是指|例如|比如|冒号|：", prompt):
        return "题干逻辑-解释关系"
    if re.search(r"因为|由于|因此|所以|只有|从而|导致", prompt):
        return "题干逻辑-对应关系"
    if all(re.fullmatch(r"[\u3400-\u9fff]{4}", option) for option in options):
        return "词语辨析-词义"
    if re.search(r"褒义|贬义|讽刺|批评|赞扬", prompt):
        return "词语辨析-词色"
    if re.search(r"最|极|稍|略|严重|明显|强烈", prompt):
        return "词语辨析-词度"
    return "词语辨析-词用"


def other_point(prompt: str) -> str:
    if re.search(r"病句|语病|歧义|句意明确|表达正确|没有语病", prompt):
        return "病句辨析"
    if re.search(r"正确选项为|词项间关系|逻辑关系最为相似", prompt) and len(prompt) < 90:
        return "类比推理"
    if re.search(r"至少能拿到第几|多少|人数|数量", prompt):
        return "数量推理"
    if re.search(r"削弱|加强|支持|反驳|假设|前提|论证", prompt):
        return "论证推理"
    return "形式逻辑"


def classify_point(question: RawQuestion, category: str) -> str:
    if category == "标题填入题":
        return title_point(question.prompt)
    if category == "中心理解题":
        return center_point(question.prompt)
    if category == "细节判断题":
        if is_negative_prompt(question.prompt):
            if re.search(r"没有提及|未提及|无中生有", question.prompt):
                return "信息核对-无中生有"
            return "信息核对-排除错误项"
        return "信息核对-定位原文"
    if category == "词句理解题":
        return "指代类" if re.search(r"指代|指的是|所指", question.prompt) else "理解类"
    if category == "语句排序题":
        return order_point(question.prompt)
    if category == "语句填空题":
        return blank_position(question.prompt)
    if category == "接语推断题":
        return "尾句衔接"
    if category == "逻辑填空":
        return logic_fill_point(question.prompt, question.options)
    return other_point(question.prompt)


def difficulty(question: RawQuestion, category: str) -> str:
    score = 0
    prompt_length = len(question.prompt)
    average_option_length = sum(len(option) for option in question.options) / len(
        question.options
    )
    if prompt_length >= 140:
        score += 1
    if prompt_length >= 260:
        score += 1
    if prompt_length >= 360:
        score += 1
    if average_option_length >= 15:
        score += 1
    if average_option_length >= 28:
        score += 1
    if category in {"语句排序题", "语句填空题", "接语推断题"}:
        score += 1
    if category == "逻辑填空":
        blank_count = len(re.findall(r"_{2,}|（\s*）|\(\s*\)", question.prompt))
        if blank_count >= 2:
            score += 1
        if blank_count >= 3:
            score += 1
    if category == "其他文字推理":
        score += 1
    if len(question.options) == 5:
        score += 1

    if score <= 1:
        return "入门"
    if score <= 3:
        return "提高"
    return "强化"


def method_for(category: str, point: str) -> str:
    methods = {
        "标题填入题": "先提炼核心对象和核心事件，再检查标题是否准确、全面且简洁。",
        "中心理解题": "先看提问，再找中心句；用关联词、对策词和行文脉络排除片面项。",
        "细节判断题": "把每个选项定位回原文，重点检查偷换概念、范围扩大和绝对化表述。",
        "词句理解题": "回到词句前后文，结合指代对象、感情色彩和作者观点理解语境义。",
        "语句排序题": "先定首句，再用关联词、代词和重复话题绑定句群，最后验证尾句。",
        "语句填空题": "根据横线位置判断作用，再核对话题一致、逻辑连贯和前后照应。",
        "接语推断题": "重点看尾句的新话题和未展开内容，下文通常紧接这一落点。",
        "逻辑填空": "先判断上下文逻辑关系，再比较词义、感情色彩、程度和固定搭配。",
        "其他文字推理": "先把题干条件形式化，再逐项验证是否满足论证或逻辑约束。",
    }
    return f"{methods[category]} 本题重点：{point}。"


def generated_analysis(question: RawQuestion, category: str) -> str:
    answer_index = ord(question.answer) - 65
    correct_text = question.options[answer_index]
    if category == "标题填入题":
        return (
            f"标题需要同时覆盖文段的核心对象和主要内容。{question.answer}项"
            f"“{correct_text}”概括范围最完整，也符合标题简洁准确的要求，因此选择"
            f"{question.answer}。"
        )
    if category == "中心理解题":
        return (
            f"梳理文段的中心句与行文重点后，{question.answer}项“{correct_text}”"
            f"对核心意思概括最全面；其他选项或只对应局部信息，或存在过度推断。"
            f"因此选择{question.answer}。"
        )
    if category == "细节判断题":
        if is_negative_prompt(question.prompt):
            return (
                f"逐项定位原文，{question.answer}项“{correct_text}”与原文信息不符、"
                f"表述过度或未被提及，符合题干要求，因此选择{question.answer}。"
            )
        return (
            f"逐项对照原文，{question.answer}项“{correct_text}”能够由文段信息直接"
            f"推出，其他选项存在偷换概念、范围扩大或无中生有。因此选择"
            f"{question.answer}。"
        )
    if category == "词句理解题":
        return (
            f"结合该词句前后的限定信息和作者语境，{question.answer}项"
            f"“{correct_text}”解释最贴合原文，因此选择{question.answer}。"
        )
    if category == "语句排序题":
        return (
            f"先确定适合作首句的内容，再依据关联词、代词和重复话题绑定句群。"
            f"{question.answer}项“{correct_text}”衔接最连贯，因此选择"
            f"{question.answer}。"
        )
    if category == "语句填空题":
        return (
            f"横线处既要承接前文，又要与后文的话题和逻辑方向一致。"
            f"{question.answer}项“{correct_text}”衔接最自然，因此选择"
            f"{question.answer}。"
        )
    if category == "接语推断题":
        return (
            f"文段尾句已经引出下文话题，{question.answer}项“{correct_text}”"
            f"最能顺着尾句继续展开，因此选择{question.answer}。"
        )
    if category == "逻辑填空":
        return (
            f"根据上下文的逻辑关系、语义侧重和搭配习惯，"
            f"{question.answer}项“{correct_text}”代入后最通顺、准确，因此选择"
            f"{question.answer}。"
        )
    return (
        f"将题干条件逐项代入验证，{question.answer}项“{correct_text}”满足题干的"
        f"逻辑要求，其他选项不能必然成立。因此选择{question.answer}。"
    )


def build_output(
    questions: list[RawQuestion], duplicate_map: dict[int, list[int]]
) -> list[dict]:
    output = []
    for index, question in enumerate(questions, start=1):
        category = classify_category(question)
        point = classify_point(question, category)
        analysis = question.source_analysis or generated_analysis(question, category)
        output.append(
            {
                "sourceId": f"文字-{index}",
                "sourceOccurrence": question.occurrence,
                "duplicateOccurrences": duplicate_map.get(question.occurrence, []),
                "prompt": question.prompt,
                "options": question.options,
                "answer": question.answer,
                "optionCount": len(question.options),
                "category": category,
                "point": point,
                "difficulty": difficulty(question, category),
                "analysis": analysis,
                "method": method_for(category, point),
                "analysisSource": "原题解析" if question.source_analysis else "依据讲义补充",
            }
        )
    return output


def validate(output: list[dict]) -> None:
    ids = [question["sourceId"] for question in output]
    if len(ids) != len(set(ids)):
        raise ValueError("输出题号不唯一")
    for question in output:
        expected_letters = [
            chr(65 + index) for index in range(question["optionCount"])
        ]
        if len(question["options"]) != question["optionCount"]:
            raise ValueError(f"{question['sourceId']} 选项数量不一致")
        if question["answer"] not in expected_letters:
            raise ValueError(
                f"{question['sourceId']} 答案 {question['answer']} 超出 "
                f"{expected_letters}"
            )
        if not question["prompt"] or not question["analysis"]:
            raise ValueError(f"{question['sourceId']} 缺少题干或解析")


def main() -> None:
    raw = parse_questions(read_paragraphs())
    questions, duplicate_map = deduplicate(raw)
    output = build_output(questions, duplicate_map)
    validate(output)

    OUTPUT_PATH.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    REVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    review = {
        "sourceQuestions": len(raw),
        "deduplicatedQuestions": len(output),
        "removedDuplicateOccurrences": len(raw) - len(output),
        "categoryCounts": Counter(question["category"] for question in output),
        "pointCounts": Counter(question["point"] for question in output),
        "difficultyCounts": Counter(question["difficulty"] for question in output),
        "optionCountCounts": Counter(question["optionCount"] for question in output),
        "generatedAnalysisCount": sum(
            question["analysisSource"] == "依据讲义补充" for question in output
        ),
        "questions": [
            {
                "sourceId": question["sourceId"],
                "sourceOccurrence": question["sourceOccurrence"],
                "category": question["category"],
                "point": question["point"],
                "difficulty": question["difficulty"],
                "optionCount": question["optionCount"],
                "answer": question["answer"],
                "promptPreview": question["prompt"][:120],
            }
            for question in output
        ],
    }
    REVIEW_PATH.write_text(
        json.dumps(review, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({key: value for key, value in review.items() if key != "questions"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
