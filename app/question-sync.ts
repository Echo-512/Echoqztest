"use client";

import materialQuestionData from "./material-questions.json";
import graphicQuestionData from "./questions.json";
import verbalQuestionData from "./verbal-questions.json";
import { supabase } from "./supabase-client";

type QuestionRecord = Record<string, unknown> & { sourceId: string };

type QuestionRow = {
  id: string;
  question_text: string | null;
  image: string | null;
  options: unknown;
  option_images: unknown;
  option_count: number | null;
  correct_answer: string | null;
  explanation: string | null;
  method: string | null;
  difficulty: string | null;
  question_type: string | null;
  category: string | null;
  fine_points: string[] | null;
  source: string | null;
  original_number: number | null;
  source_occurrence: number | null;
  metadata: Record<string, unknown> | null;
};

const letters = ["A", "B", "C", "D", "E", "F"];
const graphicQuestions = graphicQuestionData as QuestionRecord[];
const materialQuestions = materialQuestionData as QuestionRecord[];
const verbalQuestions = verbalQuestionData as QuestionRecord[];
const graphicById = new Map(graphicQuestions.map((question) => [question.sourceId, question]));
const materialById = new Map(materialQuestions.map((question) => [question.sourceId, question]));
const verbalById = new Map(verbalQuestions.map((question) => [question.sourceId, question]));

function orderedValues(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  if (!value || typeof value !== "object") return [];
  const values = value as Record<string, unknown>;
  return letters.filter((letter) => values[letter] != null).map((letter) => String(values[letter]));
}

function difficultyFor(value: string | null) {
  return value === "提高" || value === "强化" ? value : "入门";
}

function numberValues(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === "number")
    : [];
}

function createQuestion(row: QuestionRow): QuestionRecord | null {
  const answer = row.correct_answer?.trim();
  const optionCount = row.option_count ?? 0;
  if (!answer || optionCount < 2) return null;

  if (row.question_type === "图形推理") {
    if (!row.image) return null;
    return {
      sourceId: row.id,
      image: row.image,
      optionImages: orderedValues(row.option_images),
      answer,
      optionCount,
      point: row.category || "未分类",
      difficulty: difficultyFor(row.difficulty),
      finePoints: row.fine_points ?? [],
      analysis: row.explanation ?? "",
      method: row.method ?? "",
      source: row.source === "题库2" ? "题库2" : "题库1",
      originalNumber: row.original_number ?? 0,
    };
  }

  const options = orderedValues(row.options);
  if (!row.question_text || options.length < 2) return null;

  if (row.question_type === "材料分析") {
    return {
      sourceId: row.id,
      image: row.image,
      prompt: row.question_text,
      options,
      answer,
      optionCount,
      difficulty: difficultyFor(row.difficulty),
      analysis: row.explanation ?? "",
      sourceOccurrence: row.source_occurrence ?? row.original_number ?? 0,
    };
  }

  if (row.question_type === "文字推理") {
    return {
      sourceId: row.id,
      sourceOccurrence: row.source_occurrence ?? row.original_number ?? 0,
      duplicateOccurrences: numberValues(row.metadata?.duplicateOccurrences),
      prompt: row.question_text,
      options,
      answer,
      optionCount,
      category: row.category || "其他文字推理",
      point: row.fine_points?.[0] || row.category || "未分类",
      difficulty: difficultyFor(row.difficulty),
      analysis: row.explanation ?? "",
      method: row.method ?? "",
      analysisSource:
        row.metadata?.analysisSource === "原题解析"
          ? "原题解析"
          : "依据讲义补充",
    };
  }

  return null;
}

function applyRow(row: QuestionRow) {
  if (row.question_type === "图形推理") {
    let question = graphicById.get(row.id);
    if (!question) {
      question = createQuestion(row) ?? undefined;
      if (!question) return;
      graphicQuestions.push(question);
      graphicById.set(row.id, question);
    }
    const optionImages = orderedValues(row.option_images);
    Object.assign(question, {
      sourceId: row.id,
      image: row.image || question.image,
      optionImages: optionImages.length ? optionImages : question.optionImages,
      answer: row.correct_answer || question.answer,
      optionCount: row.option_count || question.optionCount,
      point: row.category || question.point,
      difficulty: row.difficulty || question.difficulty,
      finePoints: row.fine_points?.length ? row.fine_points : question.finePoints,
      analysis: row.explanation ?? question.analysis,
      method: row.method ?? question.method,
      source: row.source ?? question.source,
      originalNumber: row.original_number ?? question.originalNumber,
    });
    return;
  }

  if (row.question_type === "材料分析") {
    let question = materialById.get(row.id);
    if (!question) {
      question = createQuestion(row) ?? undefined;
      if (!question) return;
      materialQuestions.push(question);
      materialById.set(row.id, question);
    }
    const options = orderedValues(row.options);
    Object.assign(question, {
      sourceId: row.id,
      image: row.image || question.image,
      prompt: row.question_text || question.prompt,
      options: options.length ? options : question.options,
      answer: row.correct_answer || question.answer,
      optionCount: row.option_count || question.optionCount,
      difficulty: row.difficulty || question.difficulty,
      analysis: row.explanation ?? question.analysis,
      sourceOccurrence: row.source_occurrence ?? question.sourceOccurrence,
    });
    return;
  }

  if (row.question_type === "文字推理") {
    let question = verbalById.get(row.id);
    if (!question) {
      question = createQuestion(row) ?? undefined;
      if (!question) return;
      verbalQuestions.push(question);
      verbalById.set(row.id, question);
    }
    const options = orderedValues(row.options);
    Object.assign(question, {
      sourceId: row.id,
      prompt: row.question_text || question.prompt,
      options: options.length ? options : question.options,
      answer: row.correct_answer || question.answer,
      optionCount: row.option_count || question.optionCount,
      category: row.category || question.category,
      point: row.fine_points?.[0] || row.category || question.point,
      difficulty: row.difficulty || question.difficulty,
      analysis: row.explanation ?? question.analysis,
      method: row.method ?? question.method,
      sourceOccurrence: row.source_occurrence ?? question.sourceOccurrence,
      duplicateOccurrences:
        (row.metadata?.duplicateOccurrences as unknown[] | undefined) ?? question.duplicateOccurrences,
      analysisSource: (row.metadata?.analysisSource as string | undefined) ?? question.analysisSource,
    });
  }
}

export async function refreshQuestionsFromSupabase() {
  const rows: QuestionRow[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as QuestionRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  rows.forEach(applyRow);
  return rows.length;
}
