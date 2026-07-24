from __future__ import annotations

import difflib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from functools import lru_cache
from pathlib import Path

import pypdfium2 as pdfium
from lxml import etree
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = Path("/Users/zhaoxuan/Desktop/04、 B森『图表分析』【带解析427页】.pdf")
BBOX_PATH = ROOT / "tmp/pdfs/material-bbox.html"
OCR_PATH = ROOT / "tmp/pdfs/material-ocr-late.json"
OUTPUT = ROOT / "public/questions/material"
DATA_OUTPUT = ROOT / "app/material-questions.json"
REVIEW_OUTPUT = ROOT / "tmp/pdfs/material-review.json"
SCALE = 3.0
PAGE_HEIGHT = 842.0
PAGE_WIDTH = 595.0

ANSWER_RE = re.compile(r"(?:正确答案|参考答案|答案)\s*[：:]?\s*([A-E])")
OPTION_RE = re.compile(r"^\s*([A-E])\s*(?:[:：.、]|(?=[\u3400-\u9fff]))")
NUMBER_RE = re.compile(r"^\s*(\d{1,3})(?:[.、])?\s*$")
FORMULA_RE = re.compile(r"^[\d\s.%％+\-*/÷=()（）]+$")
PROMPT_START_RE = re.compile(
    r"^(?:下图|下表|以下|根据|上图|上述|某|近年|近\d|近年来|在|企业|公司|本|对|国内|"
    r"王|A和B|SUV|IT|HOC|NEO|20\d\d|19\d\d|图表|为了|如果|如图|现有|假设|已知|"
    r"当前|世界|全国|中国|从|题\s*[：:]|\S+公司|\S+企业)"
)
PROMPT_ANY_RE = re.compile(
    r"根据|回答|问题|下图|下表|图表|调查|情况|统计|显示|反映|资料|信息"
)

OPTION_TEXT_OVERRIDES = {
    # OCR reads the answer blank as an empty A option.
    129: ["二", "三", "四", "五"],
    # Product-column labels A-E in the source table are not answer choices.
    147: ["美国最大", "俄罗斯最大", "加拿大最大", "三国相当"],
    # Source occurrence 264 renders the C marker in a way OCR misses.
    264: ["发信息", "社交", "上网", "聊天"],
    # Source occurrence 283 supplies answer E and explains that A-D are all
    # wrong, but the source screenshot omits the printed E line.
    283: [
        "2007年-2012年，男性产品的销售量的增长数逐年降低",
        "2007年-2012年，女性产品的销售量的增长数逐年攀升",
        "2012年，女性产品的利润额已经超过了男性产品",
        "近几年来，女性产品的销售增长致使产品X销量的总体增长率又有了加速的趋势",
        "以上说法均不正确",
    ],
    # The source's Chinese numeral 一 is recognized as a dash.
    318: ["一", "二", "三", "四"],
}

PROMPT_TEXT_OVERRIDES = {
    92: (
        "下表是近五年电视制作的情况。第三年国产电视剧播出部数约占当年电视剧"
        "播出部数的（ ）。"
    ),
    105: (
        "下图是2018年全国商品房销售情况数据。按照2017年销售面积由多到少，"
        "排序正确的是（ ）。"
    ),
    147: (
        "下表是DG公司5种产品在全球几个国家的销售额。关于“C产品在美国、"
        "俄罗斯、加拿大三国的销售额比重”的描述，最恰当的是（ ）。"
    ),
    180: (
        "下表为我国2019年第四季度邮政总量统计表。2019年第四季度邮政业务"
        "总量和电信业务总量相差（ ）亿元。"
    ),
    243: (
        "下图是2018年全国商品房销售情况数据。别墅、高档公寓2018年销售面积"
        "比2017年少（ ）万平方米。"
    ),
    269: "本期统计中，价格变化幅度最大的水果是（ ）。",
    271: "该地铁公司近五年来主要依靠（ ）利润盈利。",
    273: (
        "下表是近五年电视制作的情况。第二年与第一年相比，增长速度最快的是（ ）。"
    ),
    305: (
        "NARR公司成立八年来，用于产品研发的资金逐年增加。第八年产品研发投资为"
        "12310.5万元，比上一年增长38.4%。其中人工智能类产品研发投入10515.8万元，"
        "增长4.3%，增速同比分别加快9.6和9.1个百分点；大数据产品研发投入1794.7万元，"
        "增长27.9%。公司在成立的第五年时，研发投入额为（ ）。"
    ),
    309: (
        "下列图表反映了2019年某国线上图书用户购书情况。请根据图表回答以下问题："
        "根据图表信息，最不能得出的结论是（ ）。"
    ),
    311: "哪个年龄段人群的钙每日实际摄入量最低？",
    316: (
        "下图为2020年2月上映电影票房情况。若《误杀》本月票房为91万元，"
        "那么本月总票房约为（ ）万元。"
    ),
    318: "近五年，C类产品销售额对三类产品销售总额贡献最大的是第（ ）年。",
    335: (
        "D公司是我国一家物流公司。下图反映了D公司2012年、2015年和2018年使用的"
        "交通方式份额情况。其中，2018年的模式是最均衡的。对于2015—2018年交通方式"
        "份额的调整，解释最不合理的是（ ）。"
    ),
    340: (
        "如果35到40岁这个年龄段里愿意购买空气净化器的有100人，可以推算出该调查"
        "一共调查了（ ）人。"
    ),
    347: "2015—2019年货物出口总额最低的年份是（ ）。",
    402: (
        "下表反映了疫情期间平均每家受访餐饮企业主要成本费用情况。2020年预计"
        "第一季度与人工成本最接近的费用是（ ）。"
    ),
    416: (
        "最近5年来，公司业绩每年都以4%的速度增长。由于公司业绩的增速一直稳定，"
        "所以公司认为各部门那些不规律的增员举动并没有提升公司业绩，是很草率的。"
        "为此，公司对各部门近5年员工数进行了一次调查，结果如下表所示。根据这次调查，"
        "公司认为培训发展部的增员机制是最成熟的，公司做出这个论断的依据是（ ）。"
    ),
    451: "人身险保费增长率最高和人身保险费收入最高的年份分别是（ ）。",
    437: (
        "第五年年末，该公司两类产品总销售额比上年末增加（ ）万元。"
    ),
}

# Some source questions place the chart directly after the preceding answer
# explanation and omit a reliable OCR question-number marker. These intervals
# keep only the new question's source chart/introduction and stop before the
# typed question sentence.
VISUAL_INTERVAL_OVERRIDES = {
    92: (32843.5, 33044.0),
    105: (37294.0, 37519.5),
    147: (51877.0, 52098.5),
    180: (63383.5, 63560.5),
    243: (85632.5, 85854.5),
    269: (96142.5, 96416.0),
    271: (96817.0, 97046.0),
    273: (97724.5, 97898.5),
    305: (110019.0, 110247.0),
    309: (111490.0, 111670.0),
    311: (112171.5, 112380.5),
    316: (114068.5, 114352.5),
    318: (114821.5, 115070.5),
    335: (121028.0, 121287.5),
    340: (122866.0, 123154.5),
    347: (125748.5, 126021.0),
    402: (146845.5, 147025.5),
    416: (152191.5, 152327.0),
    437: (160856.5, 161118.0),
    451: (166161.5, 166414.5),
}


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).lower()
    return re.sub(r"[^a-z0-9\u3400-\u9fff]+", "", text)


def bbox_page_lines() -> list[list[tuple[float, float, str]]]:
    root = etree.parse(str(BBOX_PATH))
    namespace = {"x": "http://www.w3.org/1999/xhtml"}
    pages = []
    for page in root.xpath("//x:page", namespaces=namespace):
        lines = []
        for line in page.xpath(".//x:line", namespaces=namespace):
            text = "".join(line.xpath(".//x:word/text()", namespaces=namespace))
            value = normalize(text)
            if value:
                lines.append(
                    (float(line.get("yMin")), float(line.get("yMax")), value)
                )
        pages.append(lines)
    return pages


def align_page_offsets(pages: list[list[tuple[float, float, str]]]) -> tuple[list[float], list[dict]]:
    offsets = [0.0]
    report = []
    for page_index in range(1, len(pages)):
        previous = pages[page_index - 1]
        current = pages[page_index]
        previous_by_text: dict[str, list[float]] = defaultdict(list)
        for top, bottom, text in previous:
            if len(text) >= 5:
                previous_by_text[text].append((top + bottom) / 2)

        deltas = []
        for top, bottom, text in current:
            if len(text) < 5 or text not in previous_by_text:
                continue
            center = (top + bottom) / 2
            for previous_center in previous_by_text[text]:
                delta = previous_center - center
                if -3 <= delta <= PAGE_HEIGHT:
                    deltas.append(delta)

        best = None
        for delta in deltas:
            hits = 0
            characters = 0
            for top, bottom, text in current:
                if len(text) < 5 or text not in previous_by_text:
                    continue
                center = (top + bottom) / 2 + delta
                if any(
                    abs(center - previous_center) <= 2.5
                    for previous_center in previous_by_text[text]
                ):
                    hits += 1
                    characters += len(text)
            score = (hits, characters, -abs(delta - 720))
            if best is None or score > best[0]:
                best = (score, delta)

        if best and (best[0][0] >= 2 or best[0][1] >= 35):
            increment = best[1]
            method = "overlap"
            hits, characters = best[0][:2]
        else:
            increment = PAGE_HEIGHT
            method = "append"
            hits = characters = 0
        offsets.append(offsets[-1] + increment)
        report.append(
            {
                "page": page_index + 1,
                "method": method,
                "increment": round(increment, 2),
                "matches": hits,
                "characters": characters,
            }
        )
    return offsets, report


def load_ocr_lines(offsets: list[float]) -> list[dict]:
    ocr_pages = json.loads(OCR_PATH.read_text(encoding="utf-8"))
    lines = []
    for page_number in range(1, len(offsets) + 1):
        page = ocr_pages[str(page_number)]
        scale_y = PAGE_HEIGHT / page["height"]
        scale_x = PAGE_WIDTH / page["width"]
        for item in page["lines"]:
            text = item["text"].strip()
            lines.append(
                {
                    "global_top": offsets[page_number - 1] + item["y0"] * scale_y,
                    "global_bottom": offsets[page_number - 1] + item["y1"] * scale_y,
                    "x0": item["x0"] * scale_x,
                    "text": text,
                    "normalized": normalize(text),
                    "page": page_number,
                    "score": item["score"],
                }
            )
    lines.sort(key=lambda item: (item["global_top"], item["x0"]))

    # Adjacent screenshots overlap. Keep one OCR line at each aligned position.
    unique = []
    for line in lines:
        duplicate = False
        for previous in unique[-35:]:
            close = abs(line["global_top"] - previous["global_top"]) < 4
            same = line["normalized"] == previous["normalized"]
            contained = (
                len(line["normalized"]) > 12
                and (
                    line["normalized"] in previous["normalized"]
                    or previous["normalized"] in line["normalized"]
                )
            )
            if close and (same or contained):
                duplicate = True
                break
        if not duplicate:
            unique.append(line)
    return unique


def prompt_score(line: dict) -> int:
    text = line["text"]
    if (
        len(line["normalized"]) < 7
        or line["x0"] > 145
        or OPTION_RE.match(text)
        or ANSWER_RE.search(text)
        or text.startswith("解析")
    ):
        return -9
    score = 0
    if PROMPT_START_RE.search(text):
        score += 2
    if PROMPT_ANY_RE.search(text):
        score += 2
    if re.search(r"[?？]|\(\s*\)|（\s*）", text):
        score += 1
    if FORMULA_RE.match(text):
        score -= 5
    return score


def build_candidates(lines: list[dict]) -> list[dict]:
    answers = []
    for line in lines:
        match = ANSWER_RE.search(line["text"])
        if match:
            answers.append({**line, "answer": match.group(1)})

    candidates = []
    for answer_index, answer in enumerate(answers):
        previous_answer_top = (
            answers[answer_index - 1]["global_top"] if answer_index else -1
        )
        between = [
            line
            for line in lines
            if previous_answer_top + 2
            < line["global_top"]
            < answer["global_top"] - 1
        ]

        option_a_indices = []
        for line_index, line in enumerate(between):
            match = OPTION_RE.match(line["text"])
            if not match or match.group(1) != "A":
                continue
            option_letters = {
                option_match.group(1)
                for following in between[line_index:]
                if (option_match := OPTION_RE.match(following["text"]))
            }
            if len(option_letters) >= 2:
                option_a_indices.append(line_index)
        if not option_a_indices:
            raise RuntimeError(
                f"Could not find options before answer {answer_index + 1}: {answer['text']}"
            )

        option_a_index = option_a_indices[-1]
        before_options = between[:option_a_index]
        analysis_indices = [
            index
            for index, line in enumerate(before_options)
            if line["text"].startswith("解析")
        ]
        scan_start = analysis_indices[-1] + 1 if analysis_indices else 0
        prompt_index = None

        # Numbered questions provide the strongest start marker.
        for index in range(scan_start, len(before_options)):
            number_match = NUMBER_RE.match(before_options[index]["text"])
            if (
                number_match
                and int(number_match.group(1)) < 500
                and before_options[index]["x0"] < 135
                and any(
                    prompt_score(before_options[next_index]) >= 2
                    for next_index in range(
                        index + 1, min(len(before_options), index + 4)
                    )
                )
            ):
                prompt_index = index
                break

        if prompt_index is None:
            strong = [
                index
                for index in range(scan_start, len(before_options))
                if prompt_score(before_options[index]) >= 3
            ]
            if strong:
                prompt_index = strong[0]
        if prompt_index is None:
            weak = [
                index
                for index in range(scan_start, len(before_options))
                if prompt_score(before_options[index]) >= 2
            ]
            if weak:
                prompt_index = weak[0]

        # Some source questions place a number directly above a chart and have
        # no separate prose prompt. Keep that number as the question start.
        if prompt_index is None:
            numbers = []
            for index in range(scan_start, len(before_options)):
                number_match = NUMBER_RE.match(before_options[index]["text"])
                if (
                    number_match
                    and int(number_match.group(1)) < 500
                    and before_options[index]["x0"] < 135
                ):
                    numbers.append(index)
            if numbers:
                # The first standalone number after the preceding explanation
                # is the source question number. The last one is often merely
                # an axis tick or month label inside the chart.
                prompt_index = numbers[0]

        if prompt_index is None:
            fallback = [
                index
                for index in range(scan_start, len(before_options))
                if len(before_options[index]["normalized"]) >= 10
                and before_options[index]["x0"] < 135
                and not FORMULA_RE.match(before_options[index]["text"])
            ]
            if fallback:
                prompt_index = fallback[0]
        if prompt_index is None:
            raise RuntimeError(
                f"Could not locate prompt before answer {answer_index + 1}: {answer['text']}"
            )

        prose_start_index = (
            prompt_index + 1
            if NUMBER_RE.match(before_options[prompt_index]["text"])
            and prompt_index + 1 < len(before_options)
            else prompt_index
        )
        preceding_numbers = [
            index
            for index in range(scan_start, prompt_index)
            if NUMBER_RE.match(before_options[index]["text"])
            and int(NUMBER_RE.match(before_options[index]["text"]).group(1)) < 500
            and before_options[index]["x0"] < 135
        ]
        crop_start_index = preceding_numbers[0] if preceding_numbers else prompt_index
        start = before_options[crop_start_index]
        option_lines = [
            line
            for line in between[option_a_index:]
            if OPTION_RE.match(line["text"])
        ]

        # Separate left-aligned prose from labels printed inside the chart.
        # The prose becomes accessible HTML text; the visual asset keeps only
        # the source table/chart and its own title.
        prompt_lines = []
        segment = [
            line
            for line in lines
            if before_options[prose_start_index]["global_top"] - 1
            <= line["global_top"]
            < between[option_a_index]["global_top"]
        ]
        for line in segment:
            chinese_count = len(re.findall(r"[\u3400-\u9fff]", line["text"]))
            question_signal = bool(
                re.search(r"[?？]|[（(]\s*[）)]", line["text"])
            )
            chart_axis_like = (
                len(
                    re.findall(
                        r"(?:第[一二三四五六七八九十]+年|\d{1,4}月|20\d{2})",
                        line["text"],
                    )
                )
                >= 3
            )
            follows_prose = bool(
                prompt_lines
                and line["global_top"] - prompt_lines[-1]["global_bottom"] < 18
            )
            if (
                line["x0"] < 145
                and (
                    len(line["normalized"]) >= 8
                    or question_signal
                    or (follows_prose and chinese_count >= 3)
                )
                and (chinese_count >= 3 or question_signal)
                and not chart_axis_like
                and not NUMBER_RE.match(line["text"])
                and not FORMULA_RE.match(line["text"])
            ):
                prompt_lines.append(line)

        unique_prompt_lines = []
        seen_prompt_lines = set()
        for line in prompt_lines:
            if line["normalized"] in seen_prompt_lines:
                continue
            seen_prompt_lines.add(line["normalized"])
            unique_prompt_lines.append(line)
        prompt_lines = unique_prompt_lines
        prompt_text = " ".join(line["text"] for line in prompt_lines)
        prompt_text = PROMPT_TEXT_OVERRIDES.get(
            answer_index + 1, prompt_text
        )

        option_groups: dict[str, list[str]] = {}
        current_option = None
        for line in between[option_a_index:]:
            option_match = OPTION_RE.match(line["text"])
            if option_match:
                current_option = option_match.group(1)
                option_groups.setdefault(current_option, [])
                value = re.sub(
                    r"^\s*[A-E]\s*(?:[:：.、])?\s*",
                    "",
                    line["text"],
                    count=1,
                ).strip()
                if value:
                    option_groups[current_option].append(value)
                continue
            if (
                current_option
                and line["x0"] < 155
                and len(line["normalized"]) >= 2
            ):
                option_groups[current_option].append(line["text"].strip())

        option_texts = [
            " ".join(option_groups[letter]).strip()
            for letter in "ABCDE"
            if letter in option_groups
        ]
        option_texts = OPTION_TEXT_OVERRIDES.get(
            answer_index + 1,
            option_texts,
        )
        options_text = " ".join(
            f"{letter}:{' '.join(option_groups[letter]).strip()}"
            for letter in "ABCDE"
            if letter in option_groups
        )
        if answer_index + 1 in OPTION_TEXT_OVERRIDES:
            options_text = " ".join(
                f"{letter}:{text}"
                for letter, text in zip("ABCDE", option_texts)
            )

        visual_start = start["global_bottom"] + 1
        visual_end = between[option_a_index]["global_top"] - 1
        blocked = sorted(
            (
                max(visual_start, line["global_top"] - 2),
                min(visual_end, line["global_bottom"] + 2),
            )
            for line in prompt_lines
            if line["global_bottom"] >= visual_start
            and line["global_top"] <= visual_end
        )
        merged_blocks = []
        for top, bottom in blocked:
            if not merged_blocks or top > merged_blocks[-1][1] + 3:
                merged_blocks.append([top, bottom])
            else:
                merged_blocks[-1][1] = max(merged_blocks[-1][1], bottom)
        gaps = []
        cursor = visual_start
        for top, bottom in merged_blocks:
            if top > cursor:
                gaps.append((cursor, top))
            cursor = max(cursor, bottom)
        if visual_end > cursor:
            gaps.append((cursor, visual_end))
        visual_interval = max(
            gaps,
            key=lambda pair: pair[1] - pair[0],
            default=None,
        )
        if visual_interval and visual_interval[1] - visual_interval[0] < 18:
            visual_interval = None
        visual_interval = VISUAL_INTERVAL_OVERRIDES.get(
            answer_index + 1, visual_interval
        )

        signature = normalize(prompt_text + options_text)
        candidates.append(
            {
                "source_occurrence": answer_index + 1,
                # Keep the crop tight to the detected question marker. A larger
                # lead-in can pull the final line of the previous explanation
                # into the next question because the source is a continuous
                # scrolling capture.
                "start": max(0.0, start["global_top"] - 1),
                # Leave the answer marker itself outside the image while
                # retaining the full final option line immediately above it.
                "end": max(start["global_top"] + 10, answer["global_top"] - 0.5),
                "answer_top": answer["global_top"],
                "answer": answer["answer"],
                "option_count": len(option_texts),
                "prompt": prompt_text,
                "option_texts": option_texts,
                "options": options_text,
                "visual_interval": visual_interval,
                "signature": signature,
                "source_page": start["page"],
                "answer_page": answer["page"],
            }
        )
    return candidates


def attach_analyses(candidates: list[dict], lines: list[dict]) -> None:
    for index, candidate in enumerate(candidates):
        next_start = (
            candidates[index + 1]["start"]
            if index + 1 < len(candidates)
            else float("inf")
        )
        after_answer = [
            line
            for line in lines
            if candidate["answer_top"] + 1
            < line["global_top"]
            < next_start - 1
        ]
        analysis_start = next(
            (
                line_index
                for line_index, line in enumerate(after_answer)
                if line["text"].startswith("解析")
            ),
            None,
        )
        if analysis_start is None:
            candidate["analysis"] = "题库仅提供参考答案，未提供详细解析。"
            continue

        pieces = []
        seen = set()
        for line_index, line in enumerate(after_answer[analysis_start:]):
            text = line["text"].strip()
            if line_index == 0:
                text = re.sub(r"^解析\s*[：:]?\s*", "", text)
            value = normalize(text)
            if not value or value in seen:
                continue
            seen.add(value)
            pieces.append(text)
        analysis = "\n".join(pieces).strip()
        candidate["analysis"] = (
            analysis if analysis else "题库仅提供参考答案，未提供详细解析。"
        )


def is_duplicate(candidate: dict, previous: dict) -> bool:
    if candidate["answer"] != previous["answer"]:
        return False
    if candidate["signature"] and candidate["signature"] == previous["signature"]:
        return True
    prompt_a = normalize(candidate["prompt"])
    prompt_b = normalize(previous["prompt"])
    options_a = normalize(candidate["options"])
    options_b = normalize(previous["options"])
    if not prompt_a or not prompt_b or not options_a or not options_b:
        return False
    prompt_ratio = difflib.SequenceMatcher(
        None, prompt_a, prompt_b, autojunk=False
    ).ratio()
    options_ratio = difflib.SequenceMatcher(
        None, options_a, options_b, autojunk=False
    ).ratio()
    return options_ratio >= 0.95 and prompt_ratio >= 0.93


def deduplicate(candidates: list[dict]) -> tuple[list[dict], list[dict]]:
    kept = []
    duplicates = []
    for candidate in candidates:
        duplicate_of = next(
            (previous for previous in kept if is_duplicate(candidate, previous)),
            None,
        )
        if duplicate_of is None:
            kept.append(candidate)
            continue
        duplicates.append(
            {
                "removed_occurrence": candidate["source_occurrence"],
                "kept_occurrence": duplicate_of["source_occurrence"],
                "answer": candidate["answer"],
                "prompt": candidate["prompt"][:160],
            }
        )
    return kept, duplicates


pdf_document = pdfium.PdfDocument(str(PDF_PATH))


@lru_cache(maxsize=5)
def render_page(page_number: int) -> Image.Image:
    return (
        pdf_document[page_number - 1]
        .render(scale=SCALE)
        .to_pil()
        .convert("RGB")
    )


def trim_content(image: Image.Image, padding: int = 28) -> Image.Image:
    grayscale = image.convert("L")
    box = grayscale.point(lambda value: 0 if value > 248 else 255).getbbox()
    if box is None:
        return image
    left = max(0, box[0] - padding)
    top = max(0, box[1] - padding)
    right = min(image.width, box[2] + padding)
    bottom = min(image.height, box[3] + padding)
    return image.crop((left, top, right, bottom))


def compose_crop(start: float, end: float, offsets: list[float]) -> Image.Image:
    cursor = start
    pieces = []
    while cursor < end - 0.1:
        covering = [
            (page_number, offset)
            for page_number, offset in enumerate(offsets, start=1)
            if offset - 0.5 <= cursor < offset + PAGE_HEIGHT - 0.1
        ]
        if not covering:
            raise RuntimeError(f"No PDF page covers global coordinate {cursor}")
        page_number, offset = max(
            covering, key=lambda item: (item[1] + PAGE_HEIGHT, item[0])
        )
        piece_end = min(end, offset + PAGE_HEIGHT)
        page_image = render_page(page_number)
        scale_y = page_image.height / PAGE_HEIGHT
        top = max(0, int(round((cursor - offset) * scale_y)))
        bottom = min(
            page_image.height, int(round((piece_end - offset) * scale_y))
        )
        if bottom <= top:
            raise RuntimeError(
                f"Invalid crop on page {page_number}: {top} to {bottom}"
            )
        pieces.append(page_image.crop((0, top, page_image.width, bottom)))
        cursor = piece_end

    width = max(piece.width for piece in pieces)
    height = sum(piece.height for piece in pieces)
    canvas = Image.new("RGB", (width, height), "white")
    cursor_y = 0
    for piece in pieces:
        canvas.paste(piece, (0, cursor_y))
        cursor_y += piece.height
    return trim_content(canvas)


def difficulty(candidate: dict) -> str:
    analysis = candidate["analysis"]
    prompt = candidate["prompt"]
    operations = len(re.findall(r"[%％=÷/*+\-]", analysis))
    if re.search(r"看图|如图|直接|读图", analysis) and len(analysis) < 90:
        return "入门"
    score = 0
    if len(analysis) > 75:
        score += 1
    if len(analysis) > 150:
        score += 1
    if operations >= 3:
        score += 1
    if operations >= 7:
        score += 1
    if len(prompt) > 180:
        score += 1
    if score >= 3:
        return "强化"
    if score >= 1:
        return "提高"
    return "入门"


def main() -> None:
    if not PDF_PATH.exists():
        raise FileNotFoundError(PDF_PATH)
    if not BBOX_PATH.exists() or not OCR_PATH.exists():
        raise FileNotFoundError(
            "Run the bbox extraction and temporary OCR pass before rebuilding."
        )

    OUTPUT.mkdir(parents=True, exist_ok=True)
    for old_asset in OUTPUT.glob("m*.webp"):
        old_asset.unlink()

    offsets, alignment_report = align_page_offsets(bbox_page_lines())
    lines = load_ocr_lines(offsets)
    raw_candidates = build_candidates(lines)
    attach_analyses(raw_candidates, lines)
    candidates, duplicate_report = deduplicate(raw_candidates)

    question_data = []
    manifest = []
    for question_number, candidate in enumerate(candidates, start=1):
        filename = f"m{question_number:03d}.webp"
        image = None
        if candidate["visual_interval"]:
            image = compose_crop(
                candidate["visual_interval"][0],
                candidate["visual_interval"][1],
                offsets,
            )
            image.save(OUTPUT / filename, "WEBP", quality=97, method=6)
        item = {
            "sourceId": f"材料-{question_number}",
            "image": f"/questions/material/{filename}" if image else None,
            "prompt": candidate["prompt"]
            or "请根据图表及选项信息，选择符合题意的一项。",
            "options": candidate["option_texts"],
            "answer": candidate["answer"],
            "optionCount": min(5, max(2, candidate["option_count"])),
            "difficulty": difficulty(candidate),
            "analysis": candidate["analysis"],
            "sourceOccurrence": candidate["source_occurrence"],
        }
        question_data.append(item)
        manifest.append(
            {
                **item,
                "sourcePage": candidate["source_page"],
                "answerPage": candidate["answer_page"],
                "prompt": candidate["prompt"],
                "options": candidate["options"],
                "width": image.width if image else 0,
                "height": image.height if image else 0,
            }
        )
        if question_number % 25 == 0 or question_number == len(candidates):
            print(
                f"prepared {question_number}/{len(candidates)} material questions",
                flush=True,
            )

    DATA_OUTPUT.write_text(
        json.dumps(question_data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (OUTPUT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    REVIEW_OUTPUT.write_text(
        json.dumps(
            {
                "detectedOccurrences": len(raw_candidates),
                "retainedQuestions": len(candidates),
                "duplicates": duplicate_report,
                "alignment": alignment_report,
                "difficulty": dict(
                    Counter(item["difficulty"] for item in question_data)
                ),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "detected": len(raw_candidates),
                "retained": len(candidates),
                "duplicatesRemoved": len(duplicate_report),
                "difficulty": dict(
                    Counter(item["difficulty"] for item in question_data)
                ),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
