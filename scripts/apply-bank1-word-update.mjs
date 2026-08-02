import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const appQuestionsPath = fileURLToPath(new URL("../app/questions.json", import.meta.url));
const manifestPath = fileURLToPath(
  new URL("../public/questions/beisen-1-clean/manifest.json", import.meta.url),
);
const assetBase = "/questions/beisen-1-clean";
const stableIdForWordNumber = new Map([
  ["1-5", "1-13"],
  ["1-6", "1-14"],
  ["1-10", "1-18"],
]);

const [questions, manifest] = await Promise.all([
  readFile(appQuestionsPath, "utf8").then(JSON.parse),
  readFile(manifestPath, "utf8").then(JSON.parse),
]);
const byStableId = new Map(questions.map((question) => [question.sourceId, question]));
const errors = [];

function alignAnalysisConclusion(analysis, answer) {
  if (!analysis) return analysis;
  return analysis.replace(/(因此(?:应)?选择\s*)[A-E](?=[。；;,.，\s]*$)/u, `$1${answer}`);
}

for (const item of manifest) {
  const stableId = stableIdForWordNumber.get(item.question_number) ?? item.question_number;
  const question = byStableId.get(stableId);
  if (!question) {
    errors.push(`${item.question_number}: 找不到稳定题目 ID ${stableId}`);
    continue;
  }
  const optionEntries = Object.entries(item.options).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  if (optionEntries.some(([, images]) => images.length !== 1)) {
    errors.push(`${item.question_number}: 每个选项应恰好包含一张图片`);
    continue;
  }
  const stemImages = item.question_images.map((path) => `${assetBase}/${path}`);
  const optionImages = optionEntries.map(([, images]) => `${assetBase}/${images[0]}`);
  const answer = item.correct_answer || question.answer;
  if (!optionEntries.some(([letter]) => letter === answer)) {
    errors.push(`${item.question_number}: 答案 ${answer} 不在选项中`);
    continue;
  }

  Object.assign(question, {
    displayId: item.question_number,
    prompt: item.question_text || "",
    stemImages,
    image: stemImages[0] ?? "",
    optionImages,
    optionCount: optionEntries.length,
    answer,
    analysis: alignAnalysisConclusion(question.analysis, answer),
    originalNumber: Number(item.question_number.split("-")[1]),
  });
}

const sourceOne = questions.filter((question) => question.source === "题库1");
if (sourceOne.length !== manifest.length) {
  errors.push(`题库1题数 ${sourceOne.length} 与 Word 题数 ${manifest.length} 不一致`);
}
for (const question of sourceOne) {
  if (!question.displayId) errors.push(`${question.sourceId}: 缺少 Word 显示题号`);
  if (question.optionImages.length !== question.optionCount) {
    errors.push(`${question.displayId ?? question.sourceId}: 选项图数量不一致`);
  }
}
if (errors.length) throw new Error(errors.join("\n"));

await writeFile(appQuestionsPath, `${JSON.stringify(questions, null, 2)}\n`, "utf8");
console.log(`题库1已更新 ${sourceOne.length} 道，保留稳定 ID 并使用 Word 原题号显示。`);
