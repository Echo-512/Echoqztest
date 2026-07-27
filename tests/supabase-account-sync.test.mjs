import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const accountUrl = new URL("../app/account-context.tsx", import.meta.url);
const pageUrl = new URL("../app/page.tsx", import.meta.url);
const questionSyncUrl = new URL("../app/question-sync.ts", import.meta.url);
const mockUrl = new URL("../app/mock-exam.tsx", import.meta.url);
const schemaUrl = new URL("../supabase/schema.sql", import.meta.url);

test("uses email OTP registration, password login, and verified reset", async () => {
  const account = await readFile(accountUrl, "utf8");
  assert.match(account, /supabase\.auth\.getSession\(\)/);
  assert.match(account, /signInWithOtp\(\{\s*email: normalizedEmail/);
  assert.match(account, /shouldCreateUser: mode === "register"/);
  assert.match(account, /verifyOtp\(\{\s*email: normalizedEmail/);
  assert.match(account, /type: "email"/);
  assert.match(account, /signInWithPassword\(\{/);
  assert.match(account, /updateUser\(\{\s*password/);
  assert.match(account, /setCooldown\(60\)/);
  assert.match(account, /忘记密码/);
});

test("closes login immediately and returns completed registration to login", async () => {
  const account = await readFile(accountUrl, "utf8");
  assert.match(account, /onClose\(\);\s*void onAuthenticated\(true\);/);
  assert.match(account, /const completedMode = mode;/);
  assert.match(account, /await supabase\.auth\.signOut\(\)/);
  assert.match(account, /switchMode\("login"\)/);
  assert.match(account, /注册成功，请使用邮箱和密码登录/);
});

test("keeps visitor and signed-in account actions in the profile hero", async () => {
  const page = await readFile(pageUrl, "utf8");
  assert.match(page, /"游客"/);
  assert.match(page, /登录 \/ 注册/);
  assert.match(page, /编辑资料/);
  assert.match(page, /退出登录/);
  assert.match(page, /account\.questionProgress\.reduce/);
  assert.match(page, /account\.completedExamCount/);
  assert.match(page, /account\.openAuth\(\)/);
});

test("updates the displayed profile name immediately after saving", async () => {
  const account = await readFile(accountUrl, "utf8");
  const page = await readFile(pageUrl, "utf8");
  assert.match(account, /data:\s*\{\s*user:\s*updatedUser\s*\}/);
  assert.match(account, /setSession\(\(currentSession\)/);
  assert.match(account, /setProfile\(\(currentProfile\)/);
  assert.match(account, /\.upsert\(\s*\{\s*id:\s*session\.user\.id/);
  assert.match(page, /account\.session\?\.user\.user_metadata\?\.full_name/);
  assert.match(page, /account\.session\?\.user\.email\?\.split\("@"\)/);
  assert.match(page, /account\.session \? "用户" : "游客"/);
});

test("never replaces saved account progress with an empty snapshot", async () => {
  const account = await readFile(accountUrl, "utf8");
  const page = await readFile(pageUrl, "utf8");
  assert.match(account, /userStateLoaded: boolean/);
  assert.match(account, /setUserStateLoaded\(true\)/);
  assert.match(page, /function preservePracticePayload/);
  assert.match(page, /Math\.max\(\s*current\[module\]\.attempts/);
  assert.match(page, /if \(!account\.userStateLoaded\) return/);
  assert.match(page, /Math\.max\(cloudAttempts, totalAttempts\)/);
  assert.doesNotMatch(page, /const cloudIsCurrent/);
});

test("accepts new Supabase-only questions and reads mock history back", async () => {
  const questionSync = await readFile(questionSyncUrl, "utf8");
  const mock = await readFile(mockUrl, "utf8");
  assert.match(questionSync, /function createQuestion/);
  assert.match(questionSync, /graphicQuestions\.push\(question\)/);
  assert.match(questionSync, /materialQuestions\.push\(question\)/);
  assert.match(questionSync, /verbalQuestions\.push\(question\)/);
  assert.match(mock, /\.from\("exam_records"\)\s*\.select\("exam_id,details,created_at"\)/);
  assert.match(mock, /onConflict: "user_id,exam_id"/);
});

test("stores membership period and idempotent exam identifiers", async () => {
  const schema = await readFile(schemaUrl, "utf8");
  assert.match(schema, /membership_started_at timestamptz/);
  assert.match(schema, /membership_expiry timestamptz/);
  assert.match(schema, /exam_id text not null/);
  assert.match(schema, /unique \(user_id, exam_id\)/);
  assert.match(schema, /email text unique not null/);
});
