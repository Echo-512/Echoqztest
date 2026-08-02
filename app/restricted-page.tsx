"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "./account-context";
import { supabase } from "./supabase-client";

type RestrictedPageProps = {
  onBack: () => void;
};

type Receipt = {
  id: string;
  status: "provisional" | "approved" | "rejected" | "revoked";
  amount: number | string;
  currency: string;
  membership_started_at: string;
  membership_expiry: string;
  submitted_at: string;
  reviewer_note: string | null;
};

const PROMOTION_END = Date.parse("2026-09-01T00:00:00+08:00");

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: Receipt["status"]) {
  return {
    provisional: "已临时开通，等待人工复核",
    approved: "审核通过",
    rejected: "审核未通过",
    revoked: "会员已停用",
  }[status];
}

export default function RestrictedPage({ onBack }: RestrictedPageProps) {
  const account = useAccount();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const price = Date.now() < PROMOTION_END ? 12.99 : 19.99;
  const profile = account.profile;
  const membershipCurrent =
    Boolean(profile?.is_member) &&
    (!profile?.membership_expiry ||
      Date.parse(profile.membership_expiry) > Date.now());
  const pendingReceipt = receipts.some(
    (receipt) => receipt.status === "provisional",
  );

  const filePreview = useMemo(
    () => (file ? URL.createObjectURL(file) : ""),
    [file],
  );

  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  useEffect(() => {
    if (!account.session) {
      setReceipts([]);
      return;
    }
    let active = true;
    setReceiptLoading(true);
    void supabase
      .from("membership_receipts")
      .select(
        "id,status,amount,currency,membership_started_at,membership_expiry,submitted_at,reviewer_note",
      )
      .eq("user_id", account.session.user.id)
      .order("submitted_at", { ascending: false })
      .limit(10)
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setError(queryError.message);
        else setReceipts((data ?? []) as Receipt[]);
        setReceiptLoading(false);
      });
    return () => {
      active = false;
    };
  }, [account.session]);

  const chooseFile = (nextFile: File | null) => {
    setError("");
    setMessage("");
    if (!nextFile) {
      setFile(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(nextFile.type)) {
      setError("请上传 JPG、PNG 或 WebP 格式的付款截图。");
      return;
    }
    if (nextFile.size > 8 * 1024 * 1024) {
      setError("付款截图不能超过 8MB。");
      return;
    }
    setFile(nextFile);
  };

  const submitReceipt = async () => {
    if (!account.session) {
      account.openAuth();
      return;
    }
    if (!file) {
      setError("请先选择付款完成后的截图。");
      return;
    }
    if (pendingReceipt) {
      setError("已有一笔等待审核的付款记录，请勿重复提交。");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const extension =
        file.type === "image/png"
          ? "png"
          : file.type === "image/webp"
            ? "webp"
            : "jpg";
      const objectPath = `${account.session.user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("membership-receipts")
        .upload(objectPath, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data, error: insertError } = await supabase
        .from("membership_receipts")
        .insert({
          receipt_path: objectPath,
        })
        .select(
          "id,status,amount,currency,membership_started_at,membership_expiry,submitted_at,reviewer_note",
        )
        .single();
      if (insertError) throw insertError;

      setReceipts((current) => [data as Receipt, ...current]);
      setFile(null);
      await account.refreshAccountData();
      setMessage("付款凭证已保存，会员已临时开通 30 天。管理员复核后会保留或停用权限。");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "提交失败，请稍后再试。",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!account.session) {
    return (
      <main className="membership-page">
        <section className="membership-shell membership-login-card">
          <button className="membership-back" type="button" onClick={onBack}>
            ← 返回首页
          </button>
          <span className="membership-eyebrow">OFFER FAWN MEMBERSHIP</span>
          <h1>登录后开通会员</h1>
          <p>付款记录、会员期限和学习进度都会绑定到你的账号。</p>
          <button className="membership-primary" type="button" onClick={account.openAuth}>
            登录 / 注册
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="membership-page">
      <section className="membership-shell">
        <button className="membership-back" type="button" onClick={onBack}>
          ← 返回
        </button>

        <header className="membership-heading">
          <div>
            <span className="membership-eyebrow">OFFER FAWN MEMBERSHIP</span>
            <h1>{membershipCurrent ? "我的会员账户" : "开通会员"}</h1>
            <p>一个月会员 · 全题库、模考、错题集与收藏夹</p>
          </div>
          <div className="membership-price">
            <small>{price === 12.99 ? "秋招季限时价" : "标准月费"}</small>
            <strong><em>¥</em>{price.toFixed(2)}</strong>
            <span>30 天</span>
          </div>
        </header>

        {membershipCurrent && (
          <section className="membership-current" aria-label="当前会员状态">
            <div><span>状态</span><strong>会员有效</strong></div>
            <div><span>开始时间</span><strong>{formatDate(profile?.membership_started_at)}</strong></div>
            <div><span>到期时间</span><strong>{formatDate(profile?.membership_expiry)}</strong></div>
          </section>
        )}

        <section className="membership-steps" aria-label="会员开通步骤">
          <article>
            <b>01</b>
            <div>
              <h2>微信扫码支付 ¥{price.toFixed(2)}</h2>
              <p>请使用微信扫码，并在付款备注里填写下方用户 ID 或邮箱。</p>
              <div className="membership-identity">
                <span>邮箱：{account.session.user.email ?? "未设置"}</span>
                <span>用户 ID：{account.session.user.id}</span>
              </div>
            </div>
            <figure className="membership-qr">
              <img src="/offer-assets/wechat-payment-qr.jpg" alt="微信付款二维码" />
              <a href="/offer-assets/wechat-payment-qr.jpg" download="Offer-Fawn-微信付款码.jpg">
                保存付款码
              </a>
            </figure>
          </article>

          <article>
            <b>02</b>
            <div>
              <h2>上传付款完成截图</h2>
              <p>截图会私密保存在 Supabase，仅用于人工核对金额与付款记录。</p>
              <label className="membership-upload">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
                />
                {filePreview ? (
                  <img src={filePreview} alt="待提交的付款截图预览" />
                ) : (
                  <span>选择付款截图<br /><small>JPG / PNG / WebP，最大 8MB</small></span>
                )}
              </label>
            </div>
          </article>

          <article>
            <b>03</b>
            <div>
              <h2>提交并临时开通</h2>
              <p>提交后先自动获得 30 天权限；若人工审核发现凭证有误，管理员可在 Supabase 直接停用。</p>
              <button
                className="membership-primary"
                type="button"
                disabled={submitting || !file || pendingReceipt}
                onClick={() => void submitReceipt()}
              >
                {submitting
                  ? "正在安全保存…"
                  : pendingReceipt
                    ? "付款记录等待审核"
                    : membershipCurrent
                      ? "续费 30 天"
                      : "确认提交并开通"}
              </button>
              {message && <p className="membership-message">{message}</p>}
              {error && <p className="membership-error">{error}</p>}
            </div>
          </article>
        </section>

        <section className="membership-history">
          <h2>付款与审核记录</h2>
          {receiptLoading ? (
            <p>正在读取…</p>
          ) : receipts.length ? (
            <div>
              {receipts.map((receipt) => (
                <article key={receipt.id} data-status={receipt.status}>
                  <span>{formatDate(receipt.submitted_at)}</span>
                  <strong>¥{Number(receipt.amount).toFixed(2)}</strong>
                  <em>{statusLabel(receipt.status)}</em>
                  {receipt.reviewer_note && <small>{receipt.reviewer_note}</small>}
                </article>
              ))}
            </div>
          ) : (
            <p>暂时没有付款记录。</p>
          )}
        </section>

        <footer className="membership-notice">
          <strong>人工审核说明</strong>
          <p>付款凭证不会公开。管理员每天核对；伪造、重复或金额不符的凭证会被驳回并停止会员权限。</p>
        </footer>
      </section>
    </main>
  );
}
