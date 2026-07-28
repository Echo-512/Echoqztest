import { readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const defaultSupabaseUrl = "https://fijydrcorwmzamgxlcnk.supabase.co";
const defaultSupabasePublishableKey =
  "sb_publishable_SMMmRWsIWax0W90p_VDzDQ_mX8rANXY";
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  defaultSupabaseUrl;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  defaultSupabasePublishableKey;
const appDirectory = fileURLToPath(new URL("../app/", import.meta.url));
const pageSize = 1000;
const selectedColumns = [
  "id",
  "question_text",
  "image",
  "options",
  "option_images",
  "option_count",
  "correct_answer",
  "explanation",
  "method",
  "difficulty",
  "question_type",
  "category",
  "fine_points",
  "source",
  "original_number",
  "source_occurrence",
  "metadata",
].join(",");
const letters = ["A", "B", "C", "D", "E", "F"];

function orderedValues(value) {
  if (Array.isArray(value)) return value.map(String);
  if (!value || typeof value !== "object") return [];
  return letters
    .filter((letter) => value[letter] != null)
    .map((letter) => String(value[letter]));
}

function numberValues(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "number")
    : [];
}

function difficultyFor(value) {
  return value === "提高" || value === "强化" ? value : "入门";
}

async function fetchQuestionType(questionType) {
  const rows = [];

  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams({
      select: selectedColumns,
      question_type: `eq.${questionType}`,
      order: "id.asc",
      offset: String(offset),
      limit: String(pageSize),
    });
    const response = await fetch(`${supabaseUrl}/rest/v1/questions?${query}`, {
      headers: {
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${supabasePublishableKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `读取 ${questionType} 失败：${response.status} ${await response.text()}`,
      );
    }

    const page = await response.json();
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows.sort((left, right) =>
    String(left.id).localeCompare(String(right.id), "zh-CN", {
      numeric: true,
    }),
  );
}

function toGraphicQuestion(row, fallback) {
  const supabaseOptionImages = orderedValues(row.option_images);
  const optionImages = supabaseOptionImages.length
    ? supabaseOptionImages
    : fallback?.optionImages ?? [];
  const image = row.image || fallback?.image;
  const answer = row.correct_answer || fallback?.answer;
  const optionCount = row.option_count ?? fallback?.optionCount ?? optionImages.length;
  if (!row.id || !image || !answer || optionCount < 2) {
    return null;
  }
  return {
    sourceId: row.id,
    image,
    optionImages,
    answer,
    optionCount,
    point: row.category || fallback?.point || "未分类",
    difficulty: row.difficulty
      ? difficultyFor(row.difficulty)
      : fallback?.difficulty ?? "入门",
    finePoints: row.fine_points?.length
      ? row.fine_points
      : fallback?.finePoints ?? [],
    analysis: row.explanation ?? fallback?.analysis ?? "",
    method: row.method ?? fallback?.method ?? "",
    source:
      row.source === "题库2" || fallback?.source === "题库2" ? "题库2" : "题库1",
    originalNumber: row.original_number ?? fallback?.originalNumber ?? 0,
  };
}

function toMaterialQuestion(row, fallback) {
  const supabaseOptions = orderedValues(row.options);
  const options = supabaseOptions.length ? supabaseOptions : fallback?.options ?? [];
  const prompt = row.question_text || fallback?.prompt;
  const answer = row.correct_answer || fallback?.answer;
  if (!row.id || !prompt || !answer || options.length < 2) {
    return null;
  }
  return {
    sourceId: row.id,
    image: row.image || fallback?.image || null,
    prompt,
    options,
    answer,
    optionCount: row.option_count ?? fallback?.optionCount ?? options.length,
    difficulty: row.difficulty
      ? difficultyFor(row.difficulty)
      : fallback?.difficulty ?? "入门",
    analysis: row.explanation ?? fallback?.analysis ?? "",
    sourceOccurrence:
      row.source_occurrence ??
      row.original_number ??
      fallback?.sourceOccurrence ??
      0,
  };
}

function toVerbalQuestion(row, fallback) {
  const supabaseOptions = orderedValues(row.options);
  const options = supabaseOptions.length ? supabaseOptions : fallback?.options ?? [];
  const prompt = row.question_text || fallback?.prompt;
  const answer = row.correct_answer || fallback?.answer;
  if (!row.id || !prompt || !answer || options.length < 2) {
    return null;
  }
  return {
    sourceId: row.id,
    sourceOccurrence:
      row.source_occurrence ??
      row.original_number ??
      fallback?.sourceOccurrence ??
      0,
    duplicateOccurrences:
      numberValues(row.metadata?.duplicateOccurrences).length > 0
        ? numberValues(row.metadata?.duplicateOccurrences)
        : fallback?.duplicateOccurrences ?? [],
    prompt,
    options,
    answer,
    optionCount: row.option_count ?? fallback?.optionCount ?? options.length,
    category: row.category || fallback?.category || "其他文字推理",
    point:
      row.fine_points?.[0] ||
      row.category ||
      fallback?.point ||
      "未分类",
    difficulty: row.difficulty
      ? difficultyFor(row.difficulty)
      : fallback?.difficulty ?? "入门",
    analysis: row.explanation ?? fallback?.analysis ?? "",
    method: row.method ?? fallback?.method ?? "",
    analysisSource:
      row.metadata?.analysisSource === "原题解析"
        ? "原题解析"
        : fallback?.analysisSource ?? "依据讲义补充",
  };
}

async function readFallback(fileName) {
  return JSON.parse(await readFile(`${appDirectory}${fileName}`, "utf8"));
}

function buildSnapshot(fileName, rows, transform, fallbackQuestions) {
  const fallbackById = new Map(
    fallbackQuestions.map((question) => [question.sourceId, question]),
  );
  const questions = rows
    .map((row) => transform(row, fallbackById.get(row.id)))
    .filter(Boolean);
  if (!questions.length || questions.length !== rows.length) {
    throw new Error(
      `${fileName} 有 ${rows.length - questions.length} 道题资料不完整，已停止覆盖 GitHub 备用题库`,
    );
  }
  return { fileName, questions };
}

const [
  graphicRows,
  materialRows,
  verbalRows,
  graphicFallback,
  materialFallback,
  verbalFallback,
] = await Promise.all([
  fetchQuestionType("图形推理"),
  fetchQuestionType("材料分析"),
  fetchQuestionType("文字推理"),
  readFallback("questions.json"),
  readFallback("material-questions.json"),
  readFallback("verbal-questions.json"),
]);
const snapshots = [
  buildSnapshot("questions.json", graphicRows, toGraphicQuestion, graphicFallback),
  buildSnapshot(
    "material-questions.json",
    materialRows,
    toMaterialQuestion,
    materialFallback,
  ),
  buildSnapshot(
    "verbal-questions.json",
    verbalRows,
    toVerbalQuestion,
    verbalFallback,
  ),
];

await Promise.all(
  snapshots.map(({ fileName, questions }) =>
    writeFile(
      `${appDirectory}.${fileName}.tmp`,
      `${JSON.stringify(questions, null, 2)}\n`,
      "utf8",
    ),
  ),
);
for (const { fileName } of snapshots) {
  await rename(`${appDirectory}.${fileName}.tmp`, `${appDirectory}${fileName}`);
}

const counts = snapshots.map(({ questions }) => questions.length);

console.log(
  `Supabase 题库快照已生成：图形 ${counts[0]} 道，材料 ${counts[1]} 道，文字 ${counts[2]} 道，共 ${counts.reduce((sum, count) => sum + count, 0)} 道。`,
);
