import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const accountUrl = new URL("../app/account-context.tsx", import.meta.url);
const pageUrl = new URL("../app/page.tsx", import.meta.url);
const questionSnapshotUrl = new URL(
  "../scripts/sync-question-snapshot.mjs",
  import.meta.url,
);
const mockUrl = new URL("../app/mock-exam.tsx", import.meta.url);
const schemaUrl = new URL("../supabase/schema.sql", import.meta.url);
const netlifyUrl = new URL("../netlify.toml", import.meta.url);

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
  assert.match(page, /account\.completedExamQuestionCount/);
  assert.match(page, /account\.completedExamCorrectCount/);
  assert.match(page, /account\.openAuth\(\)/);
});

test("uses native Next.js output on Netlify and includes cloud exam totals", async () => {
  const account = await readFile(accountUrl, "utf8");
  const page = await readFile(pageUrl, "utf8");
  const netlify = await readFile(netlifyUrl, "utf8");
  assert.match(netlify, /command = "pnpm run sync:questions && pnpm exec next build"/);
  assert.match(netlify, /publish = "\.next"/);
  assert.match(account, /\.select\("total_questions,correct_count,details"\)/);
  assert.match(account, /setCompletedExamQuestionCount/);
  assert.match(account, /setCompletedExamCorrectCount/);
  assert.match(account, /summarizeExamPerformance/);
  assert.match(page, /cloudAttempts \+ account\.completedExamQuestionCount/);
  assert.match(page, /cloudCorrect \+ account\.completedExamCorrectCount/);
  assert.match(page, /combinedPerformance\[wrongModule\]\.wrongIds/);
});

test("updates the displayed profile name immediately after saving", async () => {
  const account = await readFile(accountUrl, "utf8");
  const page = await readFile(pageUrl, "utf8");
  assert.match(account, /data:\s*\{\s*user:\s*updatedUser\s*\}/);
  assert.match(account, /setSession\(\(currentSession\)/);
  assert.match(account, /setProfile\(\(currentProfile\)/);
  assert.match(account, /\.from\("users"\)\s*\.update\(\{/);
  assert.match(account, /\.eq\("id", session\.user\.id\)/);
  assert.doesNotMatch(account, /\.upsert\(\s*\{\s*id:\s*session\.user\.id/);
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
  assert.match(page, /Math\.max\(cloudRecordedAttempts, totalAttempts\)/);
  assert.doesNotMatch(page, /const cloudIsCurrent/);
});

test("builds a Supabase-first static question snapshot without blocking visitors", async () => {
  const page = await readFile(pageUrl, "utf8");
  const questionSnapshot = await readFile(questionSnapshotUrl, "utf8");
  const mock = await readFile(mockUrl, "utf8");
  assert.match(questionSnapshot, /fetchQuestionType\("图形推理"\)/);
  assert.match(questionSnapshot, /fetchQuestionType\("材料分析"\)/);
  assert.match(questionSnapshot, /fetchQuestionType\("文字推理"\)/);
  assert.match(questionSnapshot, /buildSnapshot\("questions\.json"/);
  assert.match(questionSnapshot, /buildSnapshot\(\s*"material-questions\.json"/);
  assert.match(questionSnapshot, /buildSnapshot\(\s*"verbal-questions\.json"/);
  assert.doesNotMatch(page, /正在同步最新题库/);
  assert.doesNotMatch(page, /refreshQuestionsFromSupabase\(\)/);
  assert.match(mock, /\.from\("exam_records"\)\s*\.select\("exam_id,details,created_at"\)/);
  assert.match(mock, /onConflict: "user_id,exam_id"/);
});

test("stores membership, protected history, exact practice totals, and favorites", async () => {
  const schema = await readFile(schemaUrl, "utf8");
  assert.match(schema, /membership_started_at timestamptz/);
  assert.match(schema, /membership_expiry timestamptz/);
  assert.match(schema, /exam_id text not null/);
  assert.match(schema, /unique \(user_id, exam_id\)/);
  assert.match(schema, /email text unique not null/);
  assert.match(schema, /correct_attempts integer not null default 0/);
  assert.match(schema, /create table if not exists public\.user_favorites/);
  assert.match(schema, /is_active boolean not null default true/);
  assert.match(schema, /revoke delete, truncate[\s\S]*public\.user_favorites/);
  assert.doesNotMatch(
    schema,
    /create policy (?:progress|exams|state|favorites)_delete_self/,
  );
});

test("keeps a signed-in device active for seven days of inactivity", async () => {
  const account = await readFile(accountUrl, "utf8");
  assert.match(account, /LOGIN_INACTIVITY_WINDOW_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(account, /LAST_ACTIVE_AT_KEY/);
  assert.match(account, /Date\.now\(\) - lastActiveAt <= LOGIN_INACTIVITY_WINDOW_MS/);
  assert.match(account, /window\.localStorage\.setItem\(LAST_ACTIVE_AT_KEY/);
  assert.match(account, /await supabase\.auth\.signOut\(\)/);
});

test("reads independent Supabase favorites and cumulative correct attempts", async () => {
  const account = await readFile(accountUrl, "utf8");
  const page = await readFile(pageUrl, "utf8");
  assert.match(account, /\.from\("user_favorites"\)/);
  assert.match(account, /\.eq\("is_active", true\)/);
  assert.match(account, /setQuestionFavorite/);
  assert.match(account, /correct_attempts:/);
  assert.match(page, /cloudProgress\[moduleKey\]\.correct \+= item\.correct_attempts/);
  assert.match(page, /account\.completedExamQuestionIds/);
});
