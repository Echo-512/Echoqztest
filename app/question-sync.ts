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
  source_occurrence: string | null;
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

function applyRow(row: QuestionRow) {
  if (row.question_type === "图形推理") {
    const question = graphicById.get(row.id);
    if (!question) return;
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
    const question = materialById.get(row.id);
    if (!question) return;
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
    const question = verbalById.get(row.id);
    if (!question) return;
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
