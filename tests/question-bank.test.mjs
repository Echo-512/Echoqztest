import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const questionsUrl = new URL("../app/questions.json", import.meta.url);
const pageUrl = new URL("../app/page.tsx", import.meta.url);

test("contains 247 unique deduplicated questions using original Excel IDs", async () => {
  const questions = JSON.parse(await readFile(questionsUrl, "utf8"));
  assert.equal(questions.length, 247);
  assert.equal(new Set(questions.map((question) => question.sourceId)).size, 247);
  assert.equal(questions.filter((question) => question.source === "题库1").length, 52);
  assert.equal(questions.filter((question) => question.source === "题库2").length, 195);
  assert.ok(questions.some((question) => question.sourceId === "1-1"));
  assert.ok(questions.some((question) => question.sourceId === "2-237"));
});

test("every referenced PDF image exists and every question has a gradeable answer", async () => {
  const questions = JSON.parse(await readFile(questionsUrl, "utf8"));
  for (const question of questions) {
    assert.match(question.answer, /^[A-E]$/, question.sourceId);
    assert.ok(question.optionCount >= 3 && question.optionCount <= 5, question.sourceId);
    await access(new URL(`../public${question.image}`, import.meta.url));
    for (const image of question.optionImages) {
      await access(new URL(`../public${image}`, import.meta.url));
    }
  }
});

test("keeps answers hidden until submit and renders split PDF options as choices", async () => {
  const page = await readFile(pageUrl, "utf8");
  assert.match(page, /function submitAnswer\(\)/);
  assert.match(page, /提交前不会显示答案/);
  assert.match(page, /const answered = Boolean\(submitted\[activeId\]\)/);
  assert.match(page, /source-option-button/);
  assert.match(page, /!answered \?/);
});

test("saves progress locally, resumes sessions, and times each question separately", async () => {
  const page = await readFile(pageUrl, "utf8");
  assert.match(page, /qiuzhao-xingce-graphic-session-v1/);
  assert.match(page, /window\.localStorage\.setItem/);
  assert.match(page, /继续上次刷题/);
  assert.match(page, /questionTimes/);
  assert.match(page, /本题计时/);
  assert.match(page, /setCurrentSeconds\(questionTimes\[nextId\] \?\? 0\)/);
});

test("provides return navigation at every nested level", async () => {
  const page = await readFile(pageUrl, "utf8");
  assert.match(page, /返回首页/);
  assert.match(page, /返回题型/);
  assert.match(page, /返回练习方式/);
});
