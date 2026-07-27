import { eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { examDrafts } from "@/db/schema";

export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ error: "Authentication required" }, { status: 401 });
}

function unavailable() {
  return Response.json(
    { error: "Cloud exam draft is temporarily unavailable" },
    { status: 503 },
  );
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return unauthorized();

  try {
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
  } catch {
    return unavailable();
  }
}

export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return unauthorized();

  let body: { draft?: unknown };
  try {
    body = (await request.json()) as { draft?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.draft || typeof body.draft !== "object") {
    return Response.json({ error: "Invalid exam draft" }, { status: 400 });
  }

  const payloadJson = JSON.stringify(body.draft);
  if (payloadJson.length > 2_000_000) {
    return Response.json({ error: "Exam draft is too large" }, { status: 413 });
  }
  const updatedAt = new Date().toISOString();

  try {
    await getDb()
      .insert(examDrafts)
      .values({ userEmail: user.email, payloadJson, updatedAt })
      .onConflictDoUpdate({
        target: examDrafts.userEmail,
        set: { payloadJson, updatedAt },
      });
    return Response.json({ updatedAt });
  } catch {
    return unavailable();
  }
}

export async function DELETE() {
  const user = await getChatGPTUser();
  if (!user) return unauthorized();

  try {
    await getDb()
      .delete(examDrafts)
      .where(eq(examDrafts.userEmail, user.email));
    return new Response(null, { status: 204 });
  } catch {
    return unavailable();
  }
}
