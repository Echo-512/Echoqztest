import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("contains the finished aptitude-test home page and deployable worker", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /秋招行测/);
  assert.match(page, /大厂行测/);
  assert.match(page, /进入分类刷题/);
  assert.match(page, /进入模考/);
  assert.match(page, /错题集/);
  assert.match(page, /看看题库结构/);
  assert.doesNotMatch(page, /codex-preview|Your site is taking shape|Building your site/i);
  await access(new URL("../dist/server/index.js", import.meta.url));
});

test("keeps answer disclosure behind explicit submission", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /function submitAnswer\(\)/);
  assert.match(page, /确认提交/);
  assert.match(page, /提交前不会显示答案/);
  assert.match(page, /Boolean\(activeSession\?\.submitted\[activeId\]\)/);
  assert.match(page, /!answered \?/);
  await access(new URL("../public/og.png", import.meta.url));
});
