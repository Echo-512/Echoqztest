import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../app/page.tsx", import.meta.url);
const mockUrl = new URL("../app/mock-exam.tsx", import.meta.url);
const workerUrl = new URL("../public/question-cache-sw.js", import.meta.url);
const syncUrl = new URL(
  "../scripts/sync-question-snapshot.mjs",
  import.meta.url,
);

test("caches every question image in the background without blocking practice", async () => {
  const [page, mock, worker, sync] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(mockUrl, "utf8"),
    readFile(workerUrl, "utf8"),
    readFile(syncUrl, "utf8"),
  ]);

  assert.match(page, /const allQuestionImageUrls/);
  assert.match(page, /orderedGraphicQuestions\.slice\(0, 5\)/);
  assert.match(page, /materialQuestions\.slice\(0, 5\)/);
  assert.match(page, /const preloadAheadCount = 5/);
  assert.match(page, /navigator\.serviceWorker\.register/);
  assert.match(page, /CACHE_QUESTION_IMAGES/);
  assert.match(mock, /const rollingPreloadCount = 5/);
  assert.match(worker, /backgroundConcurrency = 2/);
  assert.match(worker, /requestTimeoutMs = 12_000/);
  assert.match(worker, /startsWith\("\/questions\/"\)/);
  assert.match(worker, /cacheInBatches\(cacheName, priorityUrls\)/);
  assert.match(worker, /cacheInBatches\(cacheName, remainingUrls\)/);
  assert.match(sync, /question-cache-version\.json/);
  assert.match(sync, /createHash\("sha256"\)/);
});
