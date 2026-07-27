import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { examAttempts } from "@/db/schema";
import { getChatGPTUser } from "@/app/chatgpt-auth";

export const dynamic = "force-dynamic";

type ExamModule = {
  questionIds?: unknown;
  correct?: unknown;
  sectionElapsed?: unknown;
};

type ExamRecord = {
  id?: unknown;
  startedAt?: unknown;
  completedAt?: unknown;
  modules?: unknown;
};

function unauthorized() {
  return Response.json({ error: "Authentication required" }, { status: 401 });
}

function unavailable() {
  return Response.json(
    { error: "Cloud exam history is temporarily unavailable" },
    { status: 503 },
  );
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function examSummary(record: ExamRecord) {
  if (
    typeof record.id !== "string" ||
    typeof record.startedAt !== "string" ||
    typeof record.completedAt !== "string" ||
    !record.modules ||
    typeof record.modules !== "object"
  ) {
    return null;
  }

  const modules = Object.values(record.modules) as ExamModule[];
  const questionIds = modules.flatMap((module) =>
    Array.isArray(module.questionIds)
      ? module.questionIds.filter((id): id is string => typeof id === "string")
      : [],
  );
  const totalCorrect = modules.reduce((sum, module) => {
    if (!Array.isArray(module.questionIds) || !module.correct) return sum;
    const correct = module.correct as Record<string, unknown>;
    return (
      sum +
      module.questionIds.filter(
        (id) => typeof id === "string" && correct[id] === true,
      ).length
    );
  }, 0);
  const durationSeconds = modules.reduce(
    (sum, module) =>
      sum +
      (typeof module.sectionElapsed === "number" &&
      Number.isFinite(module.sectionElapsed)
        ? Math.max(0, Math.round(module.sectionElapsed))
        : 0),
    0,
  );

  return {
    id: record.id,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    totalCorrect,
    totalQuestions: questionIds.length,
    durationSeconds,
    questionIds,
  };
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return unauthorized();

  try {
    const db = getDb();
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      const [row] = await db
        .select({ payloadJson: examAttempts.payloadJson })
        .from(examAttempts)
        .where(
          and(
            eq(examAttempts.id, id),
            eq(examAttempts.userEmail, user.email),
          ),
        )
        .limit(1);
      return row
        ? Response.json({ record: parseJson(row.payloadJson) })
        : Response.json({ error: "Exam record not found" }, { status: 404 });
    }

    const rows = await db
      .select({
        id: examAttempts.id,
        startedAt: examAttempts.startedAt,
        completedAt: examAttempts.completedAt,
        totalCorrect: examAttempts.totalCorrect,
        totalQuestions: examAttempts.totalQuestions,
        durationSeconds: examAttempts.durationSeconds,
        questionIdsJson: examAttempts.questionIdsJson,
      })
      .from(examAttempts)
      .where(eq(examAttempts.userEmail, user.email))
      .orderBy(desc(examAttempts.completedAt))
      .limit(30);

    return Response.json({
      records: rows.map(({ questionIdsJson, ...row }) => ({
        ...row,
        questionIds: parseJson(questionIdsJson) ?? [],
      })),
    });
  } catch {
    return unavailable();
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return unauthorized();

  let record: ExamRecord;
  try {
    record = (await request.json()) as ExamRecord;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const summary = examSummary(record);
  if (!summary || summary.totalQuestions === 0) {
    return Response.json({ error: "Invalid exam record" }, { status: 400 });
  }

  const payloadJson = JSON.stringify(record);
  if (payloadJson.length > 2_000_000) {
    return Response.json({ error: "Exam record is too large" }, { status: 413 });
  }

  try {
    const db = getDb();
    await db
      .insert(examAttempts)
      .values({
        ...summary,
        userEmail: user.email,
        questionIdsJson: JSON.stringify(summary.questionIds),
        payloadJson,
      })
      .onConflictDoUpdate({
        target: examAttempts.id,
        set: {
          userEmail: user.email,
          startedAt: summary.startedAt,
          completedAt: summary.completedAt,
          totalCorrect: summary.totalCorrect,
          totalQuestions: summary.totalQuestions,
          durationSeconds: summary.durationSeconds,
          questionIdsJson: JSON.stringify(summary.questionIds),
          payloadJson,
        },
      });
    return Response.json({ id: summary.id }, { status: 201 });
  } catch {
    return unavailable();
  }
}
