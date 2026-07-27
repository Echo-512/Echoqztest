import { eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { practiceStates } from "@/db/schema";

export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ error: "Authentication required" }, { status: 401 });
}

function unavailable() {
  return Response.json(
    { error: "Cloud progress is temporarily unavailable" },
    { status: 503 },
  );
}

function parsePayload(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return unauthorized();

  try {
    const [row] = await getDb()
      .select()
      .from(practiceStates)
      .where(eq(practiceStates.userEmail, user.email))
      .limit(1);
    return Response.json({
      payload: row ? parsePayload(row.payloadJson) : null,
      updatedAt: row?.updatedAt ?? null,
    });
  } catch {
    return unavailable();
  }
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return unauthorized();

  let body: { payload?: unknown };
  try {
    body = (await request.json()) as { payload?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const payload = body.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return Response.json({ error: "Invalid progress payload" }, { status: 400 });
  }

  const progress = payload as {
    sessions?: unknown;
    performance?: unknown;
    favorites?: unknown;
  };
  if (
    !progress.sessions ||
    !progress.performance ||
    !progress.favorites?.valueOf
  ) {
    return Response.json({ error: "Incomplete progress payload" }, { status: 400 });
  }

  const payloadJson = JSON.stringify(payload);
  if (payloadJson.length > 2_000_000) {
    return Response.json(
      { error: "Progress payload is too large" },
      { status: 413 },
    );
  }
  const updatedAt = new Date().toISOString();

  try {
    await getDb()
      .insert(practiceStates)
      .values({ userEmail: user.email, payloadJson, updatedAt })
      .onConflictDoUpdate({
        target: practiceStates.userEmail,
        set: { payloadJson, updatedAt },
      });
    return Response.json({ updatedAt });
  } catch {
    return unavailable();
  }
}
