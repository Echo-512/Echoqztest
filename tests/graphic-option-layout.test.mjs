import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("stacks three and five graphic choices but keeps four choices in a 2 by 2 grid", () => {
  assert.match(
    css,
    /\.question-card\s*>\s*\.source-options\[data-option-count="3"\][\s\S]*?\.question-card\s*>\s*\.source-options\[data-option-count="5"\][\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;/,
  );
  assert.match(
    css,
    /\.question-card\s*>\s*\.source-options\[data-option-count="4"\]\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important;/,
  );
  assert.match(
    css,
    /\.question-card\s*>\s*\.source-options\[data-option-count="4"\]\s*\{[\s\S]*?grid-auto-rows:\s*minmax\(128px,\s*1fr\)\s*!important;/,
  );
  assert.match(
    css,
    /\.source-options\[data-option-count="4"\][\s\S]*?>\s*\.source-option-button\s*\{[\s\S]*?grid-column:\s*auto\s*!important;/,
  );
});
