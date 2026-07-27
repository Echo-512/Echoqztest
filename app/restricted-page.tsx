"use client";

type RestrictedPageProps = {
  onBack: () => void;
};

export default function RestrictedPage({ onBack }: RestrictedPageProps) {
  return (
    <main className="restricted-page">
      <section className="restricted-card" aria-labelledby="restricted-title">
        <span className="restricted-eyebrow">MEMBERSHIP</span>
        <h1 id="restricted-title">免费期已结束，请充值</h1>
        <p>会员支付功能即将上线，敬请期待。</p>
        <button type="button" disabled>
          暂未开放
        </button>
        <button className="restricted-back" type="button" onClick={onBack}>
          返回首页
        </button>
      </section>
    </main>
  );
}
