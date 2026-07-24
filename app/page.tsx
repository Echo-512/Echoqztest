"use client";

import { useEffect, useMemo, useState } from "react";

type Point = "位置规律" | "样式规律" | "属性规律" | "数量规律" | "特殊规律";
type Difficulty = "入门" | "提高" | "强化";
type Screen = "home" | "mode" | "practice" | "result";
type Position = "tl" | "tr" | "br" | "bl";
type VisualSpec = {
  kind: "arrow" | "corner" | "spokes" | "half" | "nest" | "pair" | "lines" | "dots" | "dual" | "combo";
  value?: number;
  rotation?: number;
  position?: Position;
  secondPosition?: Position;
  inverted?: boolean;
  parts?: string[];
  outer?: "square" | "circle";
};
type Question = {
  id: number;
  point: Point;
  difficulty: Difficulty;
  finePoints: string[];
  instruction: string;
  sequence: VisualSpec[];
  options: VisualSpec[];
  answer: number;
  analysis: string;
  method: string;
};

const questions: Question[] = [
  {
    id: 1,
    point: "位置规律",
    difficulty: "入门",
    finePoints: ["旋转", "顺时针", "90°"],
    instruction: "观察箭头方向的变化，选择最适合填入问号处的一项。",
    sequence: [
      { kind: "arrow", rotation: 0 },
      { kind: "arrow", rotation: 90 },
      { kind: "arrow", rotation: 180 },
    ],
    options: [
      { kind: "arrow", rotation: 270 },
      { kind: "arrow", rotation: 0 },
      { kind: "arrow", rotation: 45 },
      { kind: "arrow", rotation: 180 },
    ],
    answer: 0,
    method: "先看方向，再比较相邻图形的旋转角度是否恒定。",
    analysis: "箭头依次朝上、朝右、朝下，每次都顺时针旋转 90°。因此下一幅应继续顺时针旋转 90°，箭头朝左，选择 A。",
  },
  {
    id: 2,
    point: "位置规律",
    difficulty: "入门",
    finePoints: ["元素移动", "顺时针", "四角循环"],
    instruction: "黑点沿方框移动，选择下一幅图。",
    sequence: [
      { kind: "corner", position: "tl" },
      { kind: "corner", position: "tr" },
      { kind: "corner", position: "br" },
    ],
    options: [
      { kind: "corner", position: "tr" },
      { kind: "corner", position: "bl" },
      { kind: "corner", position: "tl" },
      { kind: "corner", position: "br" },
    ],
    answer: 1,
    method: "把四个角编号，记录元素每一步从哪个角移动到哪个角。",
    analysis: "黑点按左上→右上→右下的顺序，沿方框四角顺时针移动一格。下一步应到左下角，选择 B。",
  },
  {
    id: 3,
    point: "数量规律",
    difficulty: "入门",
    finePoints: ["线条数量", "等差递增", "每次加一"],
    instruction: "观察从中心伸出的线条数量，选择下一幅图。",
    sequence: [
      { kind: "spokes", value: 1 },
      { kind: "spokes", value: 2 },
      { kind: "spokes", value: 3 },
    ],
    options: [
      { kind: "spokes", value: 2 },
      { kind: "spokes", value: 5 },
      { kind: "spokes", value: 4 },
      { kind: "spokes", value: 6 },
    ],
    answer: 2,
    method: "数封闭区域、交点或线条，优先检查是否构成等差数列。",
    analysis: "从中心伸出的线条数依次为 1、2、3，公差为 1。下一幅应有 4 条线，选择 C。",
  },
  {
    id: 4,
    point: "位置规律",
    difficulty: "提高",
    finePoints: ["旋转", "角度", "45°"],
    instruction: "观察圆内黑色半圆的位置变化，选择下一幅图。",
    sequence: [
      { kind: "half", rotation: 0 },
      { kind: "half", rotation: 45 },
      { kind: "half", rotation: 90 },
    ],
    options: [
      { kind: "half", rotation: 180 },
      { kind: "half", rotation: 90 },
      { kind: "half", rotation: 225 },
      { kind: "half", rotation: 135 },
    ],
    answer: 3,
    method: "找到图形中的稳定参照，再判断黑色区域相对参照旋转了多少度。",
    analysis: "黑色半圆每次顺时针旋转 45°：0°、45°、90°。下一步应为 135°，选择 D。",
  },
  {
    id: 5,
    point: "特殊规律",
    difficulty: "提高",
    finePoints: ["图形间关系", "包含/内外关系", "内外图形互换"],
    instruction: "观察内外图形的变化，选择下一幅图。",
    sequence: [
      { kind: "nest", outer: "square" },
      { kind: "nest", outer: "circle" },
      { kind: "nest", outer: "square" },
    ],
    options: [
      { kind: "nest", outer: "square" },
      { kind: "nest", outer: "circle" },
      { kind: "nest", outer: "square", inverted: true },
      { kind: "nest", outer: "circle", inverted: true },
    ],
    answer: 1,
    method: "分别记录外框和内部元素，不要把整个图形当成一个整体观察。",
    analysis: "方形在外、圆形在外两种样式交替出现，同时内外图形互换。第四幅应恢复为圆形在外、方形在内，选择 B。",
  },
  {
    id: 6,
    point: "样式规律",
    difficulty: "入门",
    finePoints: ["遍历", "黑白轮换", "周期交替"],
    instruction: "观察左右两个圆的颜色变化，选择下一幅图。",
    sequence: [
      { kind: "pair", inverted: false },
      { kind: "pair", inverted: true },
      { kind: "pair", inverted: false },
    ],
    options: [
      { kind: "pair", inverted: false },
      { kind: "pair", inverted: true },
      { kind: "pair", inverted: false, rotation: 90 },
      { kind: "dots", value: 2 },
    ],
    answer: 1,
    method: "对黑白图形先检查颜色互换，再检查位置是否同步交换。",
    analysis: "左右圆的黑白颜色每步互换，形成“黑白—白黑—黑白”的两步周期。下一幅应为“白黑”，选择 B。",
  },
  {
    id: 7,
    point: "样式规律",
    difficulty: "提高",
    finePoints: ["图形叠加", "求同存异", "线条合并"],
    instruction: "每三幅图为一组，第三幅由前两幅运算得到。选择问号处图形。",
    sequence: [
      { kind: "lines", parts: ["h"] },
      { kind: "lines", parts: ["v"] },
      { kind: "lines", parts: ["h", "v"] },
      { kind: "lines", parts: ["d1"] },
      { kind: "lines", parts: ["d2"] },
    ],
    options: [
      { kind: "lines", parts: ["h", "v"] },
      { kind: "lines", parts: ["d1"] },
      { kind: "lines", parts: ["d1", "d2"] },
      { kind: "lines", parts: ["v"] },
    ],
    answer: 2,
    method: "把前两幅的线条逐一映射到第三幅，判断是相加、相减还是去同存异。",
    analysis: "第一组中，横线与竖线直接叠加得到“十”字。第二组沿用相同运算，两条对角线叠加应得到“×”形，选择 C。",
  },
  {
    id: 8,
    point: "数量规律",
    difficulty: "入门",
    finePoints: ["元素数量", "等差递减", "每次减一"],
    instruction: "观察黑点数量，选择下一幅图。",
    sequence: [
      { kind: "dots", value: 5 },
      { kind: "dots", value: 4 },
      { kind: "dots", value: 3 },
    ],
    options: [
      { kind: "dots", value: 1 },
      { kind: "dots", value: 2 },
      { kind: "dots", value: 4 },
      { kind: "dots", value: 6 },
    ],
    answer: 1,
    method: "数量减少时同时留意减少的位置；本题数量规律已能唯一锁定答案。",
    analysis: "黑点数依次为 5、4、3，每次减少 1 个。下一幅应有 2 个黑点，选择 B。",
  },
  {
    id: 9,
    point: "位置规律",
    difficulty: "提高",
    finePoints: ["双元素移动", "异向移动", "四角循环"],
    instruction: "三角形与圆点同时移动，选择下一幅图。",
    sequence: [
      { kind: "dual", position: "tl", secondPosition: "br" },
      { kind: "dual", position: "tr", secondPosition: "bl" },
      { kind: "dual", position: "br", secondPosition: "tl" },
    ],
    options: [
      { kind: "dual", position: "bl", secondPosition: "tr" },
      { kind: "dual", position: "tl", secondPosition: "br" },
      { kind: "dual", position: "tr", secondPosition: "tl" },
      { kind: "dual", position: "br", secondPosition: "bl" },
    ],
    answer: 0,
    method: "两个元素分别追踪：为它们画两条独立的移动轨迹。",
    analysis: "三角形沿四角顺时针移动：左上→右上→右下→左下；圆点沿四角逆时针移动：右下→左下→左上→右上。两条规律同时满足的是 A。",
  },
  {
    id: 10,
    point: "位置规律",
    difficulty: "强化",
    finePoints: ["复合规律", "旋转", "点位移动"],
    instruction: "同时观察线条方向与黑点位置，选择下一幅图。",
    sequence: [
      { kind: "combo", rotation: 0, position: "tl" },
      { kind: "combo", rotation: 45, position: "tr" },
      { kind: "combo", rotation: 90, position: "br" },
    ],
    options: [
      { kind: "combo", rotation: 135, position: "bl" },
      { kind: "combo", rotation: 90, position: "bl" },
      { kind: "combo", rotation: 135, position: "tr" },
      { kind: "combo", rotation: 180, position: "tl" },
    ],
    answer: 0,
    method: "复合题拆成两列记录：一列写线条角度，一列写黑点所在角。",
    analysis: "线条每次顺时针旋转 45°，下一步应为 135°；黑点则沿四角顺时针移动，下一步应到左下角。两条规律同时满足的是 A。",
  },
];

const pointOrder: Point[] = ["位置规律", "样式规律", "属性规律", "数量规律", "特殊规律"];
const letters = ["A", "B", "C", "D"];

function Visual({ spec, compact = false }: { spec: VisualSpec; compact?: boolean }) {
  const posClass = (position?: Position) => `pos-${position ?? "tl"}`;
  if (spec.kind === "arrow") {
    return <div className="visual-center"><span className="arrow-glyph" style={{ transform: `rotate(${spec.rotation ?? 0}deg)` }}>↑</span></div>;
  }
  if (spec.kind === "corner") {
    return <div className="visual-center"><div className="corner-box"><span className={`marker-dot ${posClass(spec.position)}`} /></div></div>;
  }
  if (spec.kind === "spokes") {
    const count = Number(spec.value ?? 1);
    return (
      <div className="visual-center"><div className="spokes">
        {Array.from({ length: count }, (_, index) => <span key={index} className="spoke" style={{ transform: `rotate(${(360 / count) * index}deg)` }} />)}
        <span className="spoke-core" />
      </div></div>
    );
  }
  if (spec.kind === "half") {
    return <div className="visual-center"><div className="half-disk" style={{ transform: `rotate(${spec.rotation ?? 0}deg)` }} /></div>;
  }
  if (spec.kind === "nest") {
    const circleOutside = spec.outer === "circle";
    return (
      <div className="visual-center"><div className={`nest-shape ${circleOutside ? "is-circle" : "is-square"} ${spec.inverted ? "is-filled" : ""}`}>
        <span className={circleOutside ? "inner-square" : "inner-circle"} />
      </div></div>
    );
  }
  if (spec.kind === "pair") {
    return (
      <div className={`visual-center pair ${spec.rotation ? "pair-vertical" : ""}`}>
        <span className={spec.inverted ? "hollow-dot" : "solid-dot"} />
        <span className={spec.inverted ? "solid-dot" : "hollow-dot"} />
      </div>
    );
  }
  if (spec.kind === "lines") {
    return <div className="visual-center"><div className="line-box">{(spec.parts ?? []).map((part) => <span key={part} className={`line-part line-${part}`} />)}</div></div>;
  }
  if (spec.kind === "dots") {
    const count = Number(spec.value ?? 1);
    return <div className={`visual-center dot-cluster ${compact ? "is-compact" : ""}`}>{Array.from({ length: count }, (_, index) => <span className="solid-dot" key={index} />)}</div>;
  }
  if (spec.kind === "dual") {
    return <div className="visual-center"><div className="dual-box"><span className={`triangle-marker ${posClass(spec.position)}`} /><span className={`marker-dot ${posClass(spec.secondPosition)}`} /></div></div>;
  }
  return <div className="visual-center"><div className="combo-box"><span className="combo-line" style={{ transform: `rotate(${spec.rotation ?? 0}deg)` }} /><span className={`marker-dot ${posClass(spec.position)}`} /></div></div>;
}

function Logo() {
  return <div className="logo" aria-label="秋招行测首页"><span className="logo-mark">Q</span><span>秋招行测</span><em>Beta</em></div>;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [session, setSession] = useState<Question[]>(questions);
  const [current, setCurrent] = useState(0);
  const [selections, setSelections] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});
  const [elapsed, setElapsed] = useState(0);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const activeQuestion = session[current];
  const chosen = selections[current];
  const hasSelection = chosen !== undefined;
  const answered = Boolean(submitted[current]);

  useEffect(() => {
    const saved = window.localStorage.getItem("qz-best-score");
    if (saved) setBestScore(Number(saved));
  }, []);
  useEffect(() => {
    if (screen !== "practice" || answered) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [screen, current, answered]);

  const counts = useMemo(
    () => pointOrder
      .map((point) => ({ point, count: questions.filter((question) => question.point === point).length }))
      .filter(({ count }) => count > 0),
    [],
  );

  function startPractice(next: Question[]) {
    setSession(next);
    setCurrent(0);
    setSelections({});
    setSubmitted({});
    setElapsed(0);
    setScore(0);
    setScreen("practice");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function startRandom() {
    startPractice([...questions].sort(() => Math.random() - 0.5));
  }
  function choose(optionIndex: number) {
    if (!answered) setSelections((value) => ({ ...value, [current]: optionIndex }));
  }
  function submitAnswer() {
    if (!hasSelection || answered) return;
    setSubmitted((value) => ({ ...value, [current]: true }));
  }
  function goNext() {
    if (current < session.length - 1) {
      setCurrent((value) => value + 1); setElapsed(0); window.scrollTo({ top: 0, behavior: "smooth" }); return;
    }
    const finalScore = session.reduce((total, question, index) => total + (selections[index] === question.answer ? 1 : 0), 0);
    setScore(finalScore);
    if (finalScore > bestScore) {
      setBestScore(finalScore);
      window.localStorage.setItem("qz-best-score", String(finalScore));
    }
    setScreen("result"); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function exitPractice() {
    setScreen("home"); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (screen === "practice" && activeQuestion) {
    return (
      <main className="practice-shell">
        <header className="practice-header">
          <button className="text-button" onClick={exitPractice} aria-label="退出练习">← 退出</button>
          <div className="progress-copy"><span>图形推理 · 北森题型解析试做</span><strong>{current + 1} / {session.length}</strong></div>
          <div className={`timer ${answered ? "is-paused" : ""}`}><span className="timer-dot" /><b>{elapsed}</b> 秒</div>
        </header>
        <div className="progress-track" aria-hidden="true"><span style={{ width: `${((current + 1) / session.length) * 100}%` }} /></div>
        <section className="question-wrap">
          <div className="question-meta"><span className="eyebrow">第 {String(current + 1).padStart(2, "0")} 题</span><span className="category-pill">{activeQuestion.point}</span></div>
          <h1>{activeQuestion.instruction}</h1>
          <div className="sequence-row" aria-label="题干图形序列">
            {activeQuestion.sequence.map((spec, index) => <div className="figure-panel" key={index}><Visual spec={spec} /></div>)}
            <div className="figure-panel question-mark">?</div>
          </div>
          <div className="options-grid" aria-label="答案选项">
            {activeQuestion.options.map((option, index) => {
              const isCorrect = answered && index === activeQuestion.answer;
              const isWrong = answered && index === chosen && index !== activeQuestion.answer;
              const isSelected = !answered && index === chosen;
              return (
                <button className={`option-card ${isSelected ? "is-selected" : ""} ${isCorrect ? "is-correct" : ""} ${isWrong ? "is-wrong" : ""}`} key={index} onClick={() => choose(index)} disabled={answered} aria-label={`选项 ${letters[index]}`}>
                  <span className="option-letter">{letters[index]}</span><Visual spec={option} compact />
                  {isCorrect && <span className="result-icon">✓</span>}{isWrong && <span className="result-icon">×</span>}
                </button>
              );
            })}
          </div>
          {!answered && (
            <div className="submit-row">
              <p className="answer-hint">
                {hasSelection ? `已选择 ${letters[chosen ?? 0]}，提交前仍可修改` : "先选择一个选项，提交前不会显示答案"}
              </p>
              <button className="submit-button" onClick={submitAnswer} disabled={!hasSelection}>确认提交</button>
            </div>
          )}
          {answered && (
            <section className="analysis-card" aria-live="polite">
              <div className={`answer-banner ${chosen === activeQuestion.answer ? "right" : "wrong"}`}><span>{chosen === activeQuestion.answer ? "回答正确" : "再想一步"}</span><strong>正确答案 {letters[activeQuestion.answer]}</strong></div>
              <div className="analysis-body">
                <div className="analysis-title">
                  <span>解析</span>
                  <div className="fine-points">
                    <em>{activeQuestion.difficulty}</em>
                    {activeQuestion.finePoints.map((point) => <em key={point}>{point}</em>)}
                  </div>
                </div>
                <p>{activeQuestion.analysis}</p>
                <div className="method-note"><span>解题抓手</span><p>{activeQuestion.method}</p></div>
                <button className="next-button" onClick={goNext}>{current === session.length - 1 ? "查看本轮成绩" : "下一题"}<span>→</span></button>
              </div>
            </section>
          )}
        </section>
      </main>
    );
  }

  if (screen === "mode") {
    return (
      <main className="mode-page">
        <nav className="site-nav"><Logo /><button className="nav-back" onClick={() => setScreen("home")}>返回首页</button></nav>
        <section className="mode-heading"><span className="eyebrow">模块 01 · 图形推理</span><h1>今天想怎么练？</h1><p>每题独立计时；选项可修改，只有确认提交后才显示答案、考点与完整推导。</p></section>
        <section className="mode-grid">
          <button className="mode-card random-card" onClick={startRandom}><span className="mode-index">01</span><div><span className="mode-kicker">推荐</span><h2>随机刷题</h2><p>打乱全部 10 道试做题，像真正考试一样进入未知题序。</p></div><span className="mode-arrow">↗</span></button>
          <div className="mode-card point-card">
            <span className="mode-index">02</span><div className="point-card-copy"><span className="mode-kicker">专项突破</span><h2>按照考点刷</h2><p>先按大类集中训练，解析里再拆到细颗粒考点。</p></div>
            <div className="point-buttons">{counts.map(({ point, count }) => <button key={point} onClick={() => startPractice(questions.filter((question) => question.point === point))}><span>{point}</span><b>{count} 题</b><em>→</em></button>)}</div>
          </div>
        </section>
        <p className="source-note">当前为 10 道北森题型解析试做。正式接入带答案的题库页面时，作答区会剥离蓝框和答案字母，只在提交后揭示答案。</p>
      </main>
    );
  }

  if (screen === "result") {
    const percentage = Math.round((score / session.length) * 100);
    return (
      <main className="result-page">
        <nav className="site-nav"><Logo /></nav>
        <section className="result-card">
          <span className="eyebrow">本轮完成</span>
          <div className="score-ring" style={{ "--score": `${percentage * 3.6}deg` } as React.CSSProperties}><div><strong>{score}</strong><span>/ {session.length}</span></div></div>
          <h1>{percentage >= 80 ? "状态很好，继续保持。" : "规律已经浮出来了。"}</h1>
          <p>本轮正确率 {percentage}%。{percentage < 80 ? "建议回到专项训练，把错题对应的大类再练一遍。" : "可以试试打乱题序，再压缩单题用时。"}</p>
          <div className="result-actions"><button className="primary-button" onClick={startRandom}>再来一轮 <span>→</span></button><button className="secondary-button" onClick={() => setScreen("mode")}>选择专项</button></div>
          <button className="home-link" onClick={exitPractice}>返回首页</button>
        </section>
      </main>
    );
  }

  return (
    <main className="home-page">
      <nav className="site-nav">
        <Logo />
        <div className="nav-links"><a href="#library">题库</a><span className="disabled-link">模拟考 <em>即将上线</em></span></div>
        <button className="nav-cta" onClick={() => setScreen("mode")}>开始刷题 <span>↗</span></button>
      </nav>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-label">FOR 2026 AUTUMN RECRUITMENT</span>
          <h1>大厂行测，<br />终于有地方<span>练了。</span></h1>
          <p>为秋招学生做的行测刷题站。先从图形推理开始，<br className="desktop-break" />不套用考公节奏，只练大厂笔试真正会遇到的思路。</p>
          <div className="hero-actions"><button className="primary-button" onClick={() => setScreen("mode")}>进入图形推理 <span>→</span></button><a href="#library">看看题库结构</a></div>
        </div>
        <div className="hero-board" aria-label="站点当前数据">
          <div className="board-top"><span>今日训练台</span><em>首版上线</em></div>
          <div className="board-score"><div><span>已收录</span><strong>10</strong><small>道解析试做题</small></div><div className="mini-chart" aria-hidden="true">{[28, 44, 34, 68, 54, 86, 74].map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}</div></div>
          <div className="board-progress"><div><span>你的历史最佳</span><strong>{bestScore} / 10</strong></div><div className="thin-track"><span style={{ width: `${bestScore * 10}%` }} /></div></div>
          <div className="board-footer"><span>逐题计时</span><span>提交后判题</span><span>拆解考点</span></div>
        </div>
      </section>
      <section className="manifesto-strip"><span>不是课程堆砌</span><i>•</i><span>是真题感训练</span><i>•</i><span>每一道都讲清为什么</span></section>
      <section className="library" id="library">
        <div className="section-heading"><div><span className="eyebrow">QUESTION BANK</span><h2>题库，从一个模块开始长大。</h2></div><p>按能力模块整理，也保留未来接入字节、腾讯、拼多多等历年题的空间。</p></div>
        <article className="module-card">
          <div className="module-number">01</div>
          <div className="module-main"><div className="module-status"><span>当前可练</span><em>10 题</em></div><h3>图形推理</h3><p>从位置、样式、数量与图形运算入手，建立一套可以快速扫描的观察顺序。</p><div className="tag-row">{pointOrder.map((point) => <span key={point}>{point}</span>)}</div></div>
          <button onClick={() => setScreen("mode")} aria-label="打开图形推理模块"><span>进入模块</span><b>↗</b></button>
        </article>
        <div className="future-grid"><article><span>02</span><h3>言语理解</h3><p>资料到位后更新</p></article><article><span>03</span><h3>数字推理</h3><p>资料到位后更新</p></article><article><span>04</span><h3>大厂历年题</h3><p>字节 · 腾讯 · 拼多多</p></article></div>
      </section>
      <section className="how-it-works">
        <div className="section-heading"><div><span className="eyebrow">ONE QUESTION, ONE LOOP</span><h2>不是刷完就算，是每题都闭环。</h2></div></div>
        <div className="steps-grid"><article><span>01</span><h3>像考试一样看题</h3><p>清爽大图、独立秒表，题面不带蓝框、答案字母和考点提示。</p></article><article><span>02</span><h3>确认提交再判定</h3><p>选择阶段可反复修改，提交后才标记正确项与误选项。</p></article><article><span>03</span><h3>顺着推导学方法</h3><p>从大类落到旋转、对称、叠加等细颗粒考点。</p></article></div>
      </section>
      <footer><Logo /><p>给正在准备秋招的我们，先把第一套题做好。</p><button onClick={() => setScreen("mode")}>开始今天的 10 题 →</button></footer>
    </main>
  );
}
