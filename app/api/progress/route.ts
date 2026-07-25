import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { practiceStates } from "../../../db/schema";

type PracticePayload = {
  sessions: Record<string, unknown>;
  performance: Record<string, unknown>;
};

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = message.includes("no such table") ? 503 : 500;
  return Response.json(
    {
      error:
        status === 503
          ? "账号进度正在初始化，请稍后重试。"
          : "账号进度暂时无法同步，请稍后重试。",
    },
    { status },
  );
}

export async function GET() {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "未登录" }, { status: 401 });

    const [row] = await getDb()
      .select()
      .from(practiceStates)
      .where(eq(practiceStates.userEmail, user.email))
      .limit(1);

    if (!row) return Response.json({ payload: null, updatedAt: null });
    return Response.json({
      payload: JSON.parse(row.payloadJson) as PracticePayload,
      updatedAt: row.updatedAt,
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "未登录" }, { status: 401 });

    const body = (await request.json()) as { payload?: PracticePayload };
    if (
      !body.payload ||
      typeof body.payload.sessions !== "object" ||
      typeof body.payload.performance !== "object"
    ) {
      return Response.json({ error: "进度数据不完整" }, { status: 400 });
    }

    const payloadJson = JSON.stringify(body.payload);
    if (payloadJson.length > 1_000_000) {
      return Response.json({ error: "进度数据过大" }, { status: 413 });
    }

    const updatedAt = new Date().toISOString();
    await getDb()
      .insert(practiceStates)
      .values({ userEmail: user.email, payloadJson, updatedAt })
      .onConflictDoUpdate({
        target: practiceStates.userEmail,
        set: { payloadJson, updatedAt },
      });

    return Response.json({ saved: true, updatedAt });
  } catch (error) {
    return routeError(error);
  }
}
