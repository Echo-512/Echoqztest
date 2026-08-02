import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const accountUrl = new URL("../app/account-context.tsx", import.meta.url);
const pageUrl = new URL("../app/page.tsx", import.meta.url);
const membershipUrl = new URL("../app/restricted-page.tsx", import.meta.url);
const migrationUrl = new URL(
  "../supabase/20260802_membership_receipts.sql",
  import.meta.url,
);
const qrUrl = new URL(
  "../public/offer-assets/wechat-payment-qr.jpg",
  import.meta.url,
);

test("gates every learning surface with current Supabase membership", async () => {
  const account = await readFile(accountUrl, "utf8");
  const page = await readFile(pageUrl, "utf8");
  assert.match(account, /MEMBERSHIP_REQUIRED_FROM/);
  assert.match(account, /function accessFor\(profile: AccountProfile \| null\)/);
  assert.match(account, /if \(!profile\?\.is_member\) return false/);
  assert.match(account, /Date\.parse\(profile\.membership_expiry\) > Date\.now\(\)/);
  assert.match(account, /window\.setInterval\(\(\) => void refreshMembership\(\), 30_000\)/);
  assert.match(page, /const MEMBERSHIP_PROTECTED_SCREENS/);
  for (const screen of [
    "categories",
    "graphic-mode",
    "verbal-mode",
    "mock",
    "practice",
    "wrong-categories",
    "favorite-categories",
  ]) {
    assert.match(page, new RegExp(`"${screen}"`));
  }
  assert.match(page, /我的会员账户/);
  assert.match(page, /开通会员/);
});

test("uploads private evidence and creates a server-authoritative receipt", async () => {
  const membership = await readFile(membershipUrl, "utf8");
  assert.match(membership, /Date\.parse\("2026-09-01T00:00:00\+08:00"\)/);
  assert.match(membership, /12\.99/);
  assert.match(membership, /19\.99/);
  assert.match(membership, /\.from\("membership-receipts"\)\s*\.upload/);
  assert.match(membership, /\.from\("membership_receipts"\)\s*\.insert/);
  assert.match(membership, /receipt_path: objectPath/);
  assert.match(membership, /付款凭证已保存，会员已临时开通 30 天/);
  await access(qrUrl);
});

test("keeps receipts private and lets only privileged review revoke access", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /alter table public\.membership_receipts enable row level security/);
  assert.match(sql, /for select to authenticated[\s\S]*auth\.uid\(\).*user_id/);
  assert.match(sql, /for insert to authenticated[\s\S]*auth\.uid\(\).*user_id/);
  assert.match(sql, /revoke all on public\.membership_receipts from anon, authenticated/);
  assert.match(sql, /grant select, insert on public\.membership_receipts to authenticated/);
  assert.match(sql, /'membership-receipts',[\s\S]*false,[\s\S]*8388608/);
  assert.match(sql, /storage\.foldername\(name\)/);
  assert.match(sql, /new\.amount := case[\s\S]*12\.99[\s\S]*19\.99/);
  assert.match(sql, /new\.membership_expiry := v_renewal_start \+ interval '30 days'/);
  assert.match(sql, /if new\.status in \('rejected', 'revoked'\)[\s\S]*set is_member = false/);
  assert.doesNotMatch(sql, /for update to authenticated/);
});
