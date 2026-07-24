import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const questionsUrl = new URL("../app/material-questions.json", import.meta.url);
const pageUrl = new URL("../app/page.tsx", import.meta.url);

test("contains the deduplicated ordered material-analysis bank", async () => {
  const questions = JSON.parse(await readFile(questionsUrl, "utf8"));
  assert.equal(questions.length, 423);
  assert.equal(new Set(questions.map((question) => question.sourceId)).size, 423);
  assert.equal(questions[0].sourceId, "材料-1");
  assert.equal(questions.at(-1).sourceId, "材料-423");
});

test("every material question is gradeable and separates copy from PDF charts", async () => {
  const questions = JSON.parse(await readFile(questionsUrl, "utf8"));
  for (const question of questions) {
    assert.match(question.answer, /^[A-E]$/, question.sourceId);
    assert.ok(question.prompt.trim().length >= 4, question.sourceId);
    assert.equal(question.options.length, question.optionCount, question.sourceId);
    assert.ok(
      question.optionCount >= question.answer.charCodeAt(0) - 64,
      `${question.sourceId} is missing the correct-answer choice`,
    );
    assert.ok(question.analysis.trim().length >= 2, question.sourceId);
    assert.doesNotMatch(
      question.prompt,
      /^(?:解析|正确答案|参考答案|答案)[：:]/,
      `${question.sourceId} begins with answer material`,
    );
    if (question.image) {
      await access(new URL(`../public${question.image}`, import.meta.url));
    }
  }
});

test("table labels cannot be mistaken for answer choices", async () => {
  const questions = JSON.parse(await readFile(questionsUrl, "utf8"));
  const byOccurrence = new Map(
    questions.map((question) => [question.sourceOccurrence, question]),
  );
  assert.deepEqual(byOccurrence.get(129).options, ["二", "三", "四", "五"]);
  assert.deepEqual(byOccurrence.get(147).options, [
    "美国最大",
    "俄罗斯最大",
    "加拿大最大",
    "三国相当",
  ]);
  assert.deepEqual(byOccurrence.get(318).options, ["一", "二", "三", "四"]);
});

test("material analysis opens directly, hides answers, saves progress, and times per question", async () => {
  const page = await readFile(pageUrl, "utf8");
  assert.match(page, />材料分析</);
  assert.doesNotMatch(page, />案例分析</);
  assert.match(page, /startMaterialPractice\(false\)/);
  assert.match(page, /qiuzhao-xingce-material-session-v1/);
  assert.match(page, /function submitMaterialAnswer\(\)/);
  assert.match(page, /screen !== "material-practice" \|\| materialAnswered/);
  assert.match(page, /setMaterialCurrentSeconds\(materialQuestionTimes\[nextId\] \?\? 0\)/);
  assert.match(page, /materialAnswered \?/);
  assert.match(page, /← 返回题型/);
});
