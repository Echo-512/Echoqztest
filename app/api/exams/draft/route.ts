import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { examDrafts } from "../../../../db/schema";

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = message.includes("no such table") ? 503 : 500;
  return Response.json(
    {
      error:
        status === 503
          ? "模考进度正在初始化，请稍后重试。"
          : "模考进度暂时无法同步，请稍后重试。",
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
      .from(examDrafts)
      .where(eq(examDrafts.userEmail, user.email))
      .limit(1);
    if (!row) return Response.json({ draft: null, updatedAt: null });

    return Response.json({
      draft: JSON.parse(row.payloadJson) as unknown,
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

    const body = (await request.json()) as { draft?: unknown };
    if (!body.draft || typeof body.draft !== "object") {
      return Response.json({ error: "模考进度不完整" }, { status: 400 });
    }
    const payloadJson = JSON.stringify(body.draft);
    if (payloadJson.length > 500_000) {
      return Response.json({ error: "模考进度过大" }, { status: 413 });
    }

    const updatedAt = new Date().toISOString();
    await getDb()
      .insert(examDrafts)
      .values({ userEmail: user.email, payloadJson, updatedAt })
      .onConflictDoUpdate({
        target: examDrafts.userEmail,
        set: { payloadJson, updatedAt },
      });
    return Response.json({ saved: true, updatedAt });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE() {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "未登录" }, { status: 401 });

    await getDb()
      .delete(examDrafts)
      .where(eq(examDrafts.userEmail, user.email));
    return Response.json({ deleted: true });
  } catch (error) {
    return routeError(error);
  }
}
