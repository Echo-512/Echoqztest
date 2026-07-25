import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const questionsUrl = new URL("../app/verbal-questions.json", import.meta.url);
const pageUrl = new URL("../app/page.tsx", import.meta.url);

test("contains the deduplicated, classified verbal bank", async () => {
  const questions = JSON.parse(await readFile(questionsUrl, "utf8"));
  assert.equal(questions.length, 754);
  assert.equal(new Set(questions.map((question) => question.sourceId)).size, 754);
  assert.equal(questions[0].sourceId, "文字-1");
  assert.equal(questions.at(-1).sourceId, "文字-754");

  const categories = new Set(questions.map((question) => question.category));
  for (const category of [
    "中心理解题",
    "标题填入题",
    "细节判断题",
    "词句理解题",
    "语句排序题",
    "语句填空题",
    "接语推断题",
    "逻辑填空",
  ]) {
    assert.ok(categories.has(category), category);
  }
});

test("every verbal question is gradeable and has complete learning metadata", async () => {
  const questions = JSON.parse(await readFile(questionsUrl, "utf8"));
  for (const question of questions) {
    assert.match(question.answer, /^[A-E]$/, question.sourceId);
    assert.equal(question.options.length, question.optionCount, question.sourceId);
    assert.equal(
      question.options.length,
      question.answer.charCodeAt(0) - 64 <= question.optionCount
        ? question.optionCount
        : -1,
      `${question.sourceId} is missing its correct choice`,
    );
    assert.ok(["入门", "提高", "强化"].includes(question.difficulty), question.sourceId);
    assert.ok(question.category.trim(), question.sourceId);
    assert.ok(question.point.trim(), question.sourceId);
    assert.ok(question.analysis.trim(), question.sourceId);
    assert.ok(question.method.trim(), question.sourceId);
    assert.doesNotMatch(question.prompt, /^(?:解析|正确答案|参考答案|答案)[：:]/);
    assert.doesNotMatch(question.analysis, /<br\s*\/?>|&nbsp;/i, question.sourceId);
  }
});

test("preserves the exact three-, four-, and five-choice source counts", async () => {
  const questions = JSON.parse(await readFile(questionsUrl, "utf8"));
  const counts = questions.reduce((result, question) => {
    result[question.optionCount] = (result[question.optionCount] ?? 0) + 1;
    return result;
  }, {});
  assert.deepEqual(counts, { 3: 6, 4: 746, 5: 2 });
});

test("supports verbal modes, persistent unfinished work, and immediate wrong-book updates", async () => {
  const page = await readFile(pageUrl, "utf8");
  assert.match(page, /qiuzhao-xingce-verbal-session-v1/);
  assert.match(page, /随机刷题/);
  assert.match(page, /按类型刷题/);
  assert.match(page, /verbal-point-buttons/);
  assert.match(page, /selected: \{ \.\.\.activeSession\.selected, \[activeId\]: letter \}/);
  assert.match(page, /if \(!isCorrect\) wrongIds\.add\(sourceId\)/);
  assert.match(page, /if \(isCorrect && context === "wrong"\) wrongIds\.delete\(sourceId\)/);
  assert.match(page, /performanceStorageKey/);
});
