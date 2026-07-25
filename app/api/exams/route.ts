import { and, desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { examAttempts } from "../../../db/schema";

type StoredExam = {
  id: string;
  startedAt: string;
  completedAt: string;
  moduleOrder: string[];
  modules: Record<
    string,
    {
      questionIds: string[];
      answers: Record<string, string>;
      correct: Record<string, boolean>;
      questionTimes: Record<string, number>;
      sectionElapsed: number;
    }
  >;
};

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = message.includes("no such table") ? 503 : 500;
  return Response.json(
    {
      error:
        status === 503
          ? "模考记录数据库正在初始化，请稍后重试。"
          : "模考记录暂时无法读取，请稍后重试。",
    },
    { status },
  );
}

export async function GET(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "未登录" }, { status: 401 });

    const id = new URL(request.url).searchParams.get("id");
    const db = getDb();
    if (id) {
      const [row] = await db
        .select()
        .from(examAttempts)
        .where(and(eq(examAttempts.id, id), eq(examAttempts.userEmail, user.email)))
        .limit(1);
      if (!row) return Response.json({ error: "记录不存在" }, { status: 404 });
      return Response.json({
        record: safeJson<StoredExam | null>(row.payloadJson, null),
      });
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
        questionIds: safeJson<string[]>(questionIdsJson, []),
      })),
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "未登录" }, { status: 401 });

    const record = (await request.json()) as StoredExam;
    if (
      !record?.id ||
      !record.startedAt ||
      !record.completedAt ||
      !Array.isArray(record.moduleOrder) ||
      !record.modules
    ) {
      return Response.json({ error: "模考记录不完整" }, { status: 400 });
    }

    const moduleStates = Object.values(record.modules);
    const questionIds = moduleStates.flatMap(
      (moduleState) => moduleState.questionIds ?? [],
    );
    const totalQuestions = questionIds.length;
    if (totalQuestions < 1 || totalQuestions > 40) {
      return Response.json({ error: "题目数量异常" }, { status: 400 });
    }

    let totalCorrect = 0;
    let durationSeconds = 0;
    for (const moduleState of moduleStates) {
      durationSeconds += Math.max(0, Math.round(moduleState.sectionElapsed ?? 0));
      for (const sourceId of moduleState.questionIds ?? []) {
        if (moduleState.correct?.[sourceId]) totalCorrect += 1;
      }
    }

    const payloadJson = JSON.stringify(record);
    if (payloadJson.length > 300_000) {
      return Response.json({ error: "模考记录过大" }, { status: 413 });
    }

    const db = getDb();
    await db
      .insert(examAttempts)
      .values({
        id: record.id,
        userEmail: user.email,
        startedAt: record.startedAt,
        completedAt: record.completedAt,
        totalCorrect,
        totalQuestions,
        durationSeconds,
        questionIdsJson: JSON.stringify(questionIds),
        payloadJson,
      })
      .onConflictDoUpdate({
        target: examAttempts.id,
        set: {
          completedAt: record.completedAt,
          totalCorrect,
          totalQuestions,
          durationSeconds,
          questionIdsJson: JSON.stringify(questionIds),
          payloadJson,
        },
      });

    return Response.json({ saved: true }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
