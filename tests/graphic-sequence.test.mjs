import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../app/page.tsx", import.meta.url);
const questionsUrl = new URL("../app/questions.json", import.meta.url);

test("temporarily opens graphic practice in natural source-id order", async () => {
  const [page, rawQuestions] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(questionsUrl, "utf8"),
  ]);
  const questions = JSON.parse(rawQuestions);
  const collator = new Intl.Collator("zh-CN", {
    numeric: true,
    sensitivity: "base",
  });
  const sourceIds = questions.map((question) => question.sourceId);

  assert.deepEqual(sourceIds, [...sourceIds].sort(collator.compare));
  assert.equal(sourceIds[0], "1-1");
  assert.match(page, /const orderedGraphicQuestions = \[\.\.\.questions\]\.sort/);
  assert.match(page, /numeric: true/);
  assert.match(page, /startPractice\(orderedGraphicQuestions\)/);
  assert.doesNotMatch(page, /startPractice\(shuffle\(questions\)\)/);
  assert.match(
    page,
    /orderedIds: orderedGraphicQuestions\.map\(\(question\) => question\.sourceId\)/,
  );
  assert.match(page, /continueFromFirstUnanswered: true/);
  assert.match(page, /<h2>顺序刷题<\/h2>/);
  assert.match(page, /跳号按原样保留/);
});
