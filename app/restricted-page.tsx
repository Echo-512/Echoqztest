"use client";

type RestrictedPageProps = {
  onBack: () => void;
};

export default function RestrictedPage({ onBack }: RestrictedPageProps) {
  return (
    <main className="restricted-page">
      <section className="restricted-card" aria-labelledby="restricted-title">
        <span className="restricted-eyebrow">MEMBERSHIP</span>
        <h1 id="restricted-title">当前版本免费开放</h1>
        <p>会员状态会同步保存，微信支付将在收款信息确定后再接入。</p>
        <button className="restricted-back" type="button" onClick={onBack}>
          返回首页
        </button>
      </section>
    </main>
  );
}
