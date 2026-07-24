import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html", host: "localhost" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders the finished aptitude-test practice home page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /秋招行测/);
  assert.match(html, /大厂行测/);
  assert.match(html, /进入分类刷题/);
  assert.match(html, /进入模考/);
  assert.match(html, /看看题库结构/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Building your site/i);
  assert.doesNotMatch(html, /正确答案/);
});

test("keeps answer disclosure behind explicit submission", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /function submitAnswer\(\)/);
  assert.match(page, /确认提交/);
  assert.match(page, /提交前不会显示答案/);
  assert.match(page, /Boolean\(submitted\[activeQuestion\.id\]\)/);
  assert.match(page, /!answered \?/);
  await access(new URL("../public/og.png", import.meta.url));
});
