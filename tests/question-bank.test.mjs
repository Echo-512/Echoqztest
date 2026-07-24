import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../app/page.tsx", import.meta.url);

test("records all 99 Bank 1 questions with PDF-source images", async () => {
  const page = await readFile(pageUrl, "utf8");

  assert.match(page, /题库1全部题目/);
  assert.match(page, /q\$\{String\(id\)\.padStart\(3, "0"\)\}\.webp/);
  assert.match(page, /answerLetters/);
  assert.match(page, /1-\$\{id\}/);

  for (const question of [1, 7, 57, 76, 83, 89, 99]) {
    await access(
      new URL(
        `../public/questions/beisen-1/q${String(question).padStart(3, "0")}.webp`,
        import.meta.url,
      ),
    );
  }
});

test("supports three-, four-, and five-option source questions", async () => {
  const page = await readFile(pageUrl, "utf8");

  assert.match(page, /57: 3/);
  assert.match(page, /76: 5/);
  assert.match(page, /77: 5/);
  assert.match(page, /83: 5/);
  assert.match(page, /89: 5/);
});

test("keeps answer disclosure behind explicit submission", async () => {
  const page = await readFile(pageUrl, "utf8");

  assert.match(page, /function submitAnswer\(\)/);
  assert.match(page, /确认提交/);
  assert.match(page, /提交前不会显示答案/);
  assert.match(page, /const answered = Boolean\(submitted\[activeQuestion\.id\]\)/);
  assert.match(page, /!answered \?/);
});
