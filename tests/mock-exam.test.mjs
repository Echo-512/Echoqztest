import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mockUrl = new URL("../app/mock-exam.tsx", import.meta.url);
const pageUrl = new URL("../app/page.tsx", import.meta.url);
const hostingUrl = new URL("../.openai/hosting.json", import.meta.url);
const schemaUrl = new URL("../db/schema.ts", import.meta.url);
const routeUrl = new URL("../app/api/exams/route.ts", import.meta.url);

test("builds a three-module, ten-minute exam with rare eleven-question sections", async () => {
  const mock = await readFile(mockUrl, "utf8");
  assert.match(mock, /shuffle<ModuleKey>\(\["graphic", "material", "verbal"\]\)/);
  assert.match(mock, /const sectionSeconds = 10 \* 60/);
  assert.match(mock, /const target = simpleEleven \? 11 : 10/);
  assert.match(mock, /Math\.random\(\) < 0\.12/);
  assert.match(mock, /不可跳题、不可回看/);
  assert.match(mock, /SECTION COMPLETE/);
});

test("excludes the previous paper and samples by both difficulty and category", async () => {
  const mock = await readFile(mockUrl, "utf8");
  assert.match(mock, /wholeBank\.filter\(\(question\) => !excluded\.has\(question\.sourceId\)\)/);
  assert.match(mock, /categoryCounts/);
  assert.match(mock, /desired: Record<Difficulty, number>/);
  assert.match(mock, /lastExamQuestionIdsKey/);
  assert.match(mock, /disabled=\{historyLoading\}/);
});

test("starts both timers only after the new question is decoded and painted", async () => {
  const mock = await readFile(mockUrl, "utf8");
  const page = await readFile(pageUrl, "utf8");
  for (const source of [mock, page]) {
    assert.match(source, /new window\.Image\(\)/);
    assert.match(source, /image\.decode\(\)/);
    assert.match(
      source,
      /requestAnimationFrame\(\(\) => window\.requestAnimationFrame/,
    );
  }
  assert.match(mock, /mockTimerEnabledRef\.current = false/);
  assert.match(mock, /if \(!mockTimerEnabledRef\.current\) return/);
  assert.match(mock, /key=\{activeQuestionId\}/);
  assert.match(mock, /旧题已停止计时，新题完整显示后自动开始/);
  assert.match(mock, /Date\.now\(\) - startedAt/);
  assert.match(page, /practiceTimerEnabledRef\.current = false/);
  assert.match(page, /key=\{activeId\}/);
});

test("renders exactly the options present and keeps progress circles non-interactive", async () => {
  const mock = await readFile(mockUrl, "utf8");
  assert.match(mock, /graphic\.optionImages\.length === graphic\.optionCount/);
  assert.match(mock, /letters\.slice\(0, graphic\.optionCount\)\.map/);
  assert.match(mock, /textQuestion\.options\.map/);
  assert.match(mock, /<section className="mock-question-strip"/);
  assert.doesNotMatch(
    mock,
    /mock-question-strip[\s\S]{0,700}onClick=\{\(\) =>.*current/,
  );
});

test("saves cloud history, supports review, and sends every mock error to the wrong book", async () => {
  const hosting = JSON.parse(await readFile(hostingUrl, "utf8"));
  const schema = await readFile(schemaUrl, "utf8");
  const route = await readFile(routeUrl, "utf8");
  const mock = await readFile(mockUrl, "utf8");
  const page = await readFile(pageUrl, "utf8");

  assert.equal(hosting.d1, "DB");
  assert.match(schema, /examAttempts/);
  assert.match(route, /getChatGPTUser/);
  assert.match(route, /userEmail/);
  assert.match(mock, /过往模考记录/);
  assert.match(mock, /全部题目回看/);
  assert.match(mock, /fetch\("\/api\/exams"/);
  assert.match(mock, /onComplete\(outcomes\)/);
  assert.match(page, /function recordMockOutcomes/);
  assert.match(page, /wrongSets\[outcome\.module\]\.add\(outcome\.sourceId\)/);
});
