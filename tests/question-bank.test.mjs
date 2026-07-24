import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../app/page.tsx", import.meta.url);

test("records only the verified first five questions from Bank 1", async () => {
  const page = await readFile(pageUrl, "utf8");

  for (const sourceId of ["1-1", "1-2", "1-3", "1-4", "1-5"]) {
    assert.match(page, new RegExp(`sourceId: "${sourceId}"`));
  }
  assert.doesNotMatch(page, /sourceId: "1-6"/);

  const verifiedAnswers = [
    ['1-1', 3],
    ['1-2', 1],
    ['1-3', 0],
    ['1-4', 3],
    ['1-5', 1],
  ];
  for (const [sourceId, answer] of verifiedAnswers) {
    assert.match(
      page,
      new RegExp(`sourceId: "${sourceId}"[\\s\\S]*?answer: ${answer},`),
    );
  }
});

test("uses clean vector artwork instead of answer-marked PDF screenshots", async () => {
  const page = await readFile(pageUrl, "utf8");

  assert.match(page, /function QuestionArt/);
  assert.match(page, /className="vector-art/);
  assert.match(page, /<QuestionArt name=\{activeQuestion\.stemArt\}/);
  assert.match(page, /<QuestionArt name=\{optionArt\}/);
  assert.doesNotMatch(page, /optionImages|stemImage|questions\/b1\/q\d+-(?:a|b|c|d)\.png/);
});

test("keeps the key structural distinctions used by the answers", async () => {
  const page = await readFile(pageUrl, "utf8");

  assert.match(page, /r3c1: \[1, 2, 3, 4\]/);
  assert.match(page, /b: \[1, 2, 3\]/);
  assert.match(page, /M88 44V66 M94 44V66 M100 44V66/);
  assert.match(page, /variant === "d" \? 1\.78 : 1\.32/);
});
