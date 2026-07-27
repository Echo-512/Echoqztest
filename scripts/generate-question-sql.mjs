import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedDir = path.join(root, "supabase", "generated");
const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];

const readJson = (name) =>
  JSON.parse(fs.readFileSync(path.join(root, "app", name), "utf8"));

const optionObject = (items = []) =>
  Object.fromEntries(items.map((value, index) => [letters[index], value]));

const graphics = readJson("questions.json").map((question) => ({
  id: question.sourceId,
  question_number: question.sourceId,
  question_text: null,
  image: question.image,
  options: {},
  option_images: optionObject(question.optionImages),
  option_count: question.optionCount,
  correct_answer: question.answer,
  explanation: question.analysis,
  method: question.method,
  difficulty: question.difficulty,
  question_type: "图形推理",
  category: question.point,
  fine_points: question.finePoints ?? [],
  source: question.source,
  original_number: question.originalNumber ?? null,
  source_occurrence: null,
  metadata: { kind: "graphic" },
}));

const materials = readJson("material-questions.json").map((question) => ({
  id: question.sourceId,
  question_number: question.sourceId,
  question_text: question.prompt,
  image: question.image,
  options: optionObject(question.options),
  option_images: {},
  option_count: question.optionCount,
  correct_answer: question.answer,
  explanation: question.analysis,
  method: null,
  difficulty: question.difficulty,
  question_type: "材料分析",
  category: "材料分析",
  fine_points: [],
  source: "北森图表分析",
  original_number: null,
  source_occurrence: question.sourceOccurrence ?? null,
  metadata: { kind: "material" },
}));

const verbals = readJson("verbal-questions.json").map((question) => ({
  id: question.sourceId,
  question_number: question.sourceId,
  question_text: question.prompt,
  image: null,
  options: optionObject(question.options),
  option_images: {},
  option_count: question.optionCount,
  correct_answer: question.answer,
  explanation: question.analysis,
  method: question.method,
  difficulty: question.difficulty,
  question_type: "文字推理",
  category: question.category,
  fine_points: question.point ? [question.point] : [],
  source: "北森言语理解",
  original_number: null,
  source_occurrence: question.sourceOccurrence ?? null,
  metadata: {
    kind: "verbal",
    analysisSource: question.analysisSource ?? null,
    duplicateOccurrences: question.duplicateOccurrences ?? [],
  },
}));

const questions = [...graphics, ...materials, ...verbals];
const ids = new Set();
const errors = [];
for (const question of questions) {
  if (ids.has(question.id)) errors.push(`重复 ID: ${question.id}`);
  ids.add(question.id);
  if (!["入门", "提高", "强化"].includes(question.difficulty)) {
    errors.push(`${question.id}: 难度无效`);
  }
  if (!letters.slice(0, question.option_count).includes(question.correct_answer)) {
    errors.push(`${question.id}: 答案 ${question.correct_answer} 超出选项范围`);
  }
  if (Object.keys(question.options).length > 0 &&
      Object.keys(question.options).length !== question.option_count) {
    errors.push(`${question.id}: 文字选项数与 option_count 不一致`);
  }
}
if (questions.length !== 1424) errors.push(`总题数应为 1424，实际 ${questions.length}`);
if (errors.length) throw new Error(errors.join("\n"));

const columns = [
  "id", "question_number", "question_text", "image", "options",
  "option_images", "option_count", "correct_answer", "explanation", "method",
  "difficulty", "question_type", "category", "fine_points", "source",
  "original_number", "source_occurrence", "metadata",
];

const sqlText = (value) => {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
};
const sqlJson = (value) => `${sqlText(JSON.stringify(value))}::jsonb`;
const valueSql = (question) => `(
  ${sqlText(question.id)},
  ${sqlText(question.question_number)},
  ${sqlText(question.question_text)},
  ${sqlText(question.image)},
  ${sqlJson(question.options)},
  ${sqlJson(question.option_images)},
  ${question.option_count},
  ${sqlText(question.correct_answer)},
  ${sqlText(question.explanation)},
  ${sqlText(question.method)},
  ${sqlText(question.difficulty)},
  ${sqlText(question.question_type)},
  ${sqlText(question.category)},
  ${sqlJson(question.fine_points)},
  ${sqlText(question.source)},
  ${question.original_number ?? "null"},
  ${question.source_occurrence ?? "null"},
  ${sqlJson(question.metadata)}
)`;

const updateSql = columns
  .filter((column) => column !== "id")
  .map((column) => `${column} = excluded.${column}`)
  .join(",\n  ");

fs.mkdirSync(generatedDir, { recursive: true });
for (const entry of fs.readdirSync(generatedDir)) {
  if (/^questions-(?:\d{3}|all)\.sql$/.test(entry)) {
    fs.unlinkSync(path.join(generatedDir, entry));
  }
}

const chunks = [];
const batchSize = 100;
for (let index = 0; index < questions.length; index += batchSize) {
  const batch = questions.slice(index, index + batchSize);
  const sql = `-- 题库数据 ${index + 1}-${index + batch.length} / ${questions.length}
insert into public.questions (${columns.join(", ")})
values
${batch.map(valueSql).join(",\n")}
on conflict (id) do update set
  ${updateSql};
`;
  const fileName = `questions-${String(chunks.length + 1).padStart(3, "0")}.sql`;
  fs.writeFileSync(path.join(generatedDir, fileName), sql);
  chunks.push({ fileName, sql, count: batch.length });
}

fs.writeFileSync(
  path.join(generatedDir, "questions-all.sql"),
  [
    "begin;",
    ...chunks.map(({ sql }) => sql),
    "commit;",
    "",
    "select question_type, count(*) from public.questions group by question_type order by question_type;",
  ].join("\n\n"),
);

const manifest = {
  total: questions.length,
  byType: {
    图形推理: graphics.length,
    材料分析: materials.length,
    文字推理: verbals.length,
  },
  batches: chunks.map(({ fileName, count }) => ({ fileName, count })),
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(
  path.join(generatedDir, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log(JSON.stringify(manifest, null, 2));
