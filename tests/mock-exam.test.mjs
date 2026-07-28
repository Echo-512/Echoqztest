import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mockUrl = new URL("../app/mock-exam.tsx", import.meta.url);
const pageUrl = new URL("../app/page.tsx", import.meta.url);
const hostingUrl = new URL("../.openai/hosting.json", import.meta.url);
const schemaUrl = new URL("../db/schema.ts", import.meta.url);
const routeUrl = new URL("../app/api/exams/route.ts", import.meta.url);

test("builds a three-module exam with a 70-second limit per question", async () => {
  const mock = await readFile(mockUrl, "utf8");
  assert.match(mock, /shuffle<ModuleKey>\(\["graphic", "material", "verbal"\]\)/);
  assert.match(mock, /const questionSeconds = 70/);
  assert.match(mock, /const target = simpleEleven \? 11 : 10/);
  assert.match(mock, /Math\.random\(\) < 0\.12/);
  assert.match(mock, /不可跳题、\s*不可回看/);
  assert.match(mock, /submitMockAnswer\(true\)/);
  assert.match(mock, /每题独立限时 70 秒/);
  assert.match(mock, /SECTION COMPLETE/);
});

test("samples a balanced paper and opens before cloud history or later modules finish", async () => {
  const mock = await readFile(mockUrl, "utf8");
  assert.match(mock, /wholeBank\.filter\(\(question\) => !excluded\.has\(question\.sourceId\)\)/);
  assert.match(mock, /categoryCounts/);
  assert.match(mock, /desired: Record<Difficulty, number>/);
  assert.match(mock, /lastExamQuestionIdsKey/);
  assert.doesNotMatch(mock, /disabled=\{historyLoading\}/);
  assert.match(mock, /const initialModulePreloadCount = 5/);
  assert.match(mock, /const backgroundPreloadBatchSize = 5/);
  assert.match(mock, /preloadFutureModules\(exam\)/);
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
  const page = await readFile(pageUrl, "utf8");
  assert.match(mock, /graphic\.optionImages\.length === graphic\.optionCount/);
  assert.match(mock, /letters\.slice\(0, graphic\.optionCount\)\.map/);
  assert.match(mock, /textQuestion\.options\.map/);
  assert.match(mock, /<section className="mock-question-strip"/);
  assert.doesNotMatch(
    mock,
    /mock-question-strip[\s\S]{0,700}onClick=\{\(\) =>.*current/,
  );
  assert.match(page, /<section className="practice-question-strip"/);
  assert.match(page, /Math\.floor\(activeSession\.current \/ 10\) \* 10/);
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

test("preloads upcoming practice questions and syncs progress for the signed-in account", async () => {
  const page = await readFile(pageUrl, "utf8");
  const schema = await readFile(schemaUrl, "utf8");
  const progressRoute = await readFile(
    new URL("../app/api/progress/route.ts", import.meta.url),
    "utf8",
  );
  const draftRoute = await readFile(
    new URL("../app/api/exams/draft/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(page, /const preloadAheadCount = 10/);
  assert.match(page, /function preloadPracticeQueue/);
  assert.match(page, /practiceImageCache/);
  assert.match(page, /fetch\("\/api\/progress"/);
  assert.match(
    page,
    /const payload: CloudPracticePayload = \{\s*sessions,\s*performance,\s*favorites: visibleFavorites/,
  );
  assert.match(schema, /practiceStates/);
  assert.match(schema, /examDrafts/);
  assert.match(progressRoute, /getChatGPTUser/);
  assert.match(progressRoute, /user\.email/);
  assert.match(progressRoute, /favorites\?/);
  assert.match(draftRoute, /getChatGPTUser/);
});

test("supports account-synced favorites in practice and mock exam", async () => {
  const page = await readFile(pageUrl, "utf8");
  const mock = await readFile(mockUrl, "utf8");

  assert.match(page, /favorite-categories/);
  assert.match(page, /function toggleFavorite/);
  assert.match(page, /function startFavoritePractice/);
  assert.match(page, /className=\{`favorite-toggle/);
  assert.match(page, /favorites=\{visibleFavorites\}/);
  assert.match(page, /account\.setQuestionFavorite\(sourceId, !isFavorite\)/);
  assert.match(mock, /onToggleFavorite/);
  assert.match(mock, /取消收藏本题/);
});
