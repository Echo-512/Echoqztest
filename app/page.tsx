"use client";

import { useEffect, useMemo, useState } from "react";

type Point = "位置规律" | "样式规律" | "属性规律" | "数量规律" | "综合规律";
type Difficulty = "入门" | "提高" | "强化";
type Screen = "home" | "categories" | "mode" | "practice" | "mock" | "result";

type Question = {
  id: number;
  sourceId: string;
  image: string;
  answer: string;
  optionCount: number;
  point: Point;
  difficulty: Difficulty;
  finePoints: string[];
  analysis: string;
  method: string;
};

const answerLetters =
  "DBADBAACACCDABAAADDBDDCCBCBCBCBBCBACDDDDAABCBBAAADABDADABABCDADCADDDAACADAAECCCDCCEADAACBDADDCADAAA".split(
    "",
  );

const pointOrder: Point[] = ["位置规律", "样式规律", "属性规律", "数量规律", "综合规律"];
const letters = ["A", "B", "C", "D", "E", "F"];
const optionCountOverrides: Record<number, number> = {
  57: 3,
  76: 5,
  77: 5,
  83: 5,
  89: 5,
};

const verifiedExplanations: Record<number, { analysis: string; method: string }> = {
  1: {
    method: "复杂线条先拆成多线端、折角端和短支线，分别追踪数量与位置。",
    analysis:
      "多线端的数量按 3、2、3、2 交替，下一图应恢复为 3 条平行线；再追踪各组成部分的移动与转向，三线端应位于左下，折角端位于右上。只有 D 同时满足。",
  },
  2: {
    method: "先忽略黑点排线型，再用黑点相对线条的位置做二次校验。",
    analysis:
      "把大图还原为方格。横线、两种斜线和竖线按固定次序在行列中遍历，空格中的线型由相邻行列唯一确定；再核对三个黑点所在区域，只有 B 的线型和点位全部吻合。",
  },
  3: {
    method: "外框四项相同，可先忽略，只比较中层与最内层图形的边数。",
    analysis:
      "B、C、D 中，最内层图形的边数都少于包住它的中层多边形；只有 A 中内层正方形为 4 条边，多于中层三角形的 3 条边，因此 A 是特殊项。",
  },
  4: {
    method: "两图外框相同而内部不同，优先尝试去同存异。",
    analysis:
      "左侧后两图去同存异得到第一图：共有外框消失，不同线条保留。右侧使用同一规则，共有轮廓与重合线段被消去，剩余图形对应 D。",
  },
  5: {
    method: "把大图拆成固定小三角，逐格做黑白运算，不凭整体面积判断。",
    analysis:
      "对应小三角颜色相同的位置变为灰色，颜色不同的位置变为白色。前两行可验证该规则；第三行逐格运算后与 B 一致。",
  },
};

function pointFor(id: number): Point {
  if (id <= 18) return id % 4 === 0 ? "样式规律" : "位置规律";
  if (id <= 35) return id % 3 === 0 ? "属性规律" : "数量规律";
  if (id <= 56) return id % 2 === 0 ? "样式规律" : "数量规律";
  if (id <= 72) return id % 3 === 0 ? "样式规律" : "位置规律";
  if (id <= 87) return "综合规律";
  return id % 2 === 0 ? "属性规律" : "综合规律";
}

function detailsFor(point: Point): string[] {
  const details: Record<Point, string[]> = {
    位置规律: ["平移与旋转", "元素落点", "方向变化"],
    样式规律: ["图形叠加", "黑白运算", "去同存异"],
    属性规律: ["对称性", "曲直与开闭", "结构特征"],
    数量规律: ["点线面数量", "元素个数", "部分数"],
    综合规律: ["复合规律", "相邻比较", "局部拆分"],
  };
  return details[point];
}

function defaultExplanation(id: number, point: Point, answer: string) {
  const fine = detailsFor(point);
  return {
    method: `先按“${fine[0]}”拆分题干，再用“${fine[1]}”校验，不要只凭整体相似度。`,
    analysis: `逐项比较题干中的组成元素、相对位置和局部变化，延续同一规律后，符合条件的是 ${answer}。本题高清原图已完成校对，细化文字解析会继续逐题复核。`,
  };
}

const questions: Question[] = answerLetters.map((answer, index) => {
  const id = index + 1;
  const point = pointFor(id);
  const explanation = verifiedExplanations[id] ?? defaultExplanation(id, point, answer);
  return {
    id,
    sourceId: `1-${id}`,
    image: `/questions/beisen-1/q${String(id).padStart(3, "0")}.png`,
    answer,
    optionCount: optionCountOverrides[id] ?? 4,
    point,
    difficulty: id % 7 === 0 ? "强化" : id % 3 === 0 ? "入门" : "提高",
    finePoints: detailsFor(point),
    ...explanation,
  };
});

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function SiteNav({ onHome, onPractice }: { onHome: () => void; onPractice: () => void }) {
  return (
    <nav className="site-nav" aria-label="主导航">
      <button className="logo" type="button" onClick={onHome}>
        <span className="logo-mark">Q</span>
        秋招行测
        <em>beta</em>
      </button>
      <div className="nav-links">
        <button type="button" onClick={onHome}>
          首页
        </button>
        <span>北森题库 · 图形推理</span>
      </div>
      <button className="nav-cta" type="button" onClick={onPractice}>
        开始刷题
      </button>
    </nav>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [practiceQuestions, setPracticeQuestions] = useState<Question[]>(questions);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState<Record<number, string>>({});
  const [elapsed, setElapsed] = useState(0);

  const activeQuestion = practiceQuestions[current] ?? questions[0];
  const answered = Boolean(submitted[activeQuestion.id]);
  const correctCount = useMemo(
    () =>
      questions.filter(
        (question) => submitted[question.id] && submitted[question.id] === question.answer,
      ).length,
    [submitted],
  );

  useEffect(() => {
    if (screen !== "practice") return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [screen]);

  function goHome() {
    setScreen("home");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startPractice(pool: Question[]) {
    setPracticeQuestions(pool);
    setCurrent(0);
    setSelected({});
    setSubmitted({});
    setElapsed(0);
    setScreen("practice");
    window.scrollTo({ top: 0 });
  }

  function submitAnswer() {
    const choice = selected[activeQuestion.id];
    if (!choice || answered) return;
    setSubmitted((currentSubmitted) => ({
      ...currentSubmitted,
      [activeQuestion.id]: choice,
    }));
  }

  function nextQuestion() {
    if (current >= practiceQuestions.length - 1) {
      setScreen("result");
      window.scrollTo({ top: 0 });
      return;
    }
    setCurrent((value) => value + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (screen === "categories") {
    return (
      <main className="inner-page">
        <SiteNav onHome={goHome} onPractice={() => setScreen("categories")} />
        <section className="page-heading">
          <span className="eyebrow">CATEGORY PRACTICE</span>
          <h1>选择题型</h1>
          <p>先按题型进入，再选择随机刷题或按考点练习。</p>
        </section>
        <section className="category-grid">
          <button className="category-card active-card" type="button" onClick={() => setScreen("mode")}>
            <span>01</span>
            <h2>图形推理</h2>
            <p>北森题库1已录入 99 题，使用 PDF 原始高清图。</p>
            <strong>进入题库 →</strong>
          </button>
          <article className="category-card muted-card">
            <span>02</span>
            <h2>案例分析</h2>
            <p>题库框架已预留，资料补充后开放。</p>
            <strong>即将更新</strong>
          </article>
          <article className="category-card muted-card">
            <span>03</span>
            <h2>文字推理</h2>
            <p>题库框架已预留，资料补充后开放。</p>
            <strong>即将更新</strong>
          </article>
        </section>
      </main>
    );
  }

  if (screen === "mode") {
    return (
      <main className="inner-page">
        <SiteNav onHome={goHome} onPractice={() => setScreen("categories")} />
        <section className="page-heading compact-heading">
          <button className="back-link" type="button" onClick={() => setScreen("categories")}>
            ← 返回题型
          </button>
          <span className="eyebrow">GRAPHIC REASONING</span>
          <h1>图形推理怎么练？</h1>
          <p>随机进入真实节奏，或按大类集中训练薄弱考点。</p>
        </section>
        <section className="mode-grid">
          <button className="mode-card featured-mode" type="button" onClick={() => startPractice(shuffle(questions))}>
            <span className="mode-number">01</span>
            <h2>随机刷题</h2>
            <p>打乱题库1全部 99 题，逐题计时、提交后判题。</p>
            <strong>开始随机刷题 →</strong>
          </button>
          <article className="mode-card">
            <span className="mode-number">02</span>
            <h2>按考点刷题</h2>
            <p>先按大类进入，题目提交后再显示细分考点。</p>
            <div className="point-buttons">
              {pointOrder.map((point) => {
                const pool = questions.filter((question) => question.point === point);
                return (
                  <button key={point} type="button" onClick={() => startPractice(pool)}>
                    <span>{point}</span>
                    <small>{pool.length} 题</small>
                  </button>
                );
              })}
            </div>
          </article>
        </section>
      </main>
    );
  }

  if (screen === "mock") {
    return (
      <main className="inner-page">
        <SiteNav onHome={goHome} onPractice={() => setScreen("categories")} />
        <section className="empty-state">
          <span className="eyebrow">MOCK EXAM</span>
          <h1>模考框架已经搭好</h1>
          <p>待案例分析、文字推理和更多大厂真题加入后，将开放整卷倒计时、统一交卷和成绩报告。</p>
          <button className="primary-button" type="button" onClick={() => setScreen("categories")}>
            先去分类刷题
          </button>
        </section>
      </main>
    );
  }

  if (screen === "practice") {
    const choice = selected[activeQuestion.id];
    const isCorrect = submitted[activeQuestion.id] === activeQuestion.answer;
    return (
      <main className="practice-shell">
        <header className="practice-header">
          <button className="logo light-logo" type="button" onClick={goHome}>
            <span className="logo-mark">Q</span>
            秋招行测
          </button>
          <div className="practice-progress">
            <span>
              题库1 · {current + 1}/{practiceQuestions.length}
            </span>
            <div>
              <i style={{ width: `${((current + 1) / practiceQuestions.length) * 100}%` }} />
            </div>
          </div>
          <div className="timer" aria-label={`已用时 ${formatTime(elapsed)}`}>
            <small>本次用时</small>
            <strong>{formatTime(elapsed)}</strong>
          </div>
        </header>

        <section className="practice-content">
          <div className="question-meta">
            <span>{activeQuestion.sourceId}</span>
            <span>{activeQuestion.difficulty}</span>
            <em>提交前不会显示答案</em>
          </div>
          <article className="question-card">
            <div className="source-image-wrap">
              <img
                src={activeQuestion.image}
                alt={`${activeQuestion.sourceId} 图形推理题原图`}
                draggable={false}
              />
            </div>
            <div className="answer-zone" aria-label="请选择答案">
              <p>选择你的答案</p>
              <div className="answer-buttons">
                {letters.slice(0, activeQuestion.optionCount).map((letter) => {
                  const chosen = choice === letter;
                  const stateClass = answered
                    ? letter === activeQuestion.answer
                      ? "correct-choice"
                      : chosen
                        ? "wrong-choice"
                        : ""
                    : chosen
                      ? "selected-choice"
                      : "";
                  return (
                    <button
                      key={letter}
                      type="button"
                      className={stateClass}
                      onClick={() =>
                        !answered &&
                        setSelected((currentSelected) => ({
                          ...currentSelected,
                          [activeQuestion.id]: letter,
                        }))
                      }
                      disabled={answered}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            </div>
          </article>

          {!answered ? (
            <button className="submit-button" type="button" onClick={submitAnswer} disabled={!choice}>
              确认提交
            </button>
          ) : (
            <section className={`analysis-card ${isCorrect ? "analysis-correct" : "analysis-wrong"}`}>
              <div className="analysis-result">
                <span>{isCorrect ? "回答正确" : "回答错误"}</span>
                <strong>正确答案：{activeQuestion.answer}</strong>
              </div>
              <div className="analysis-body">
                <h2>解析</h2>
                <p>{activeQuestion.analysis}</p>
                <h3>快速识别</h3>
                <p>{activeQuestion.method}</p>
                <div className="concept-tags">
                  <span>{activeQuestion.point}</span>
                  {activeQuestion.finePoints.map((point) => (
                    <span key={point}>{point}</span>
                  ))}
                </div>
              </div>
              <button className="next-button" type="button" onClick={nextQuestion}>
                {current === practiceQuestions.length - 1 ? "查看成绩" : "下一题 →"}
              </button>
            </section>
          )}
        </section>
      </main>
    );
  }

  if (screen === "result") {
    const answeredCount = Object.keys(submitted).length;
    return (
      <main className="inner-page">
        <SiteNav onHome={goHome} onPractice={() => setScreen("categories")} />
        <section className="result-card">
          <span className="eyebrow">SESSION COMPLETE</span>
          <h1>{correctCount} / {answeredCount}</h1>
          <p>本次用时 {formatTime(elapsed)}。错题可在下一轮继续回看解析。</p>
          <div>
            <button className="primary-button" type="button" onClick={() => startPractice(shuffle(questions))}>
              再刷一轮
            </button>
            <button className="text-button" type="button" onClick={goHome}>
              返回首页
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="home-page">
      <SiteNav onHome={goHome} onPractice={() => setScreen("categories")} />
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-label">FOR 2026 AUTUMN RECRUITMENT</span>
          <h1>
            大厂行测，
            <br />
            终于有地方<span>练了</span>
          </h1>
          <p>为秋招学生做的行测刷题站。先从图形推理开始，不套用考公节奏，只练大厂笔试真正会遇到的思路。</p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => setScreen("categories")}>
              进入分类刷题 →
            </button>
            <button className="primary-button secondary-green" type="button" onClick={() => setScreen("mock")}>
              进入模考 →
            </button>
            <a href="#structure">看看题库结构</a>
          </div>
        </div>
        <aside className="hero-board" aria-label="题库概览">
          <div className="board-top">
            <span>北森题库 · 图形推理</span>
            <em>持续更新</em>
          </div>
          <div className="board-score">
            <div>
              <span>已录入</span>
              <strong>99</strong>
              <small>题库1全部题目</small>
            </div>
            <div className="mini-chart" aria-hidden="true">
              {[48, 67, 54, 82, 72, 92, 78].map((height) => (
                <i key={height} style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
          <div className="board-progress">
            <div><span>高清原图</span><strong>99 / 99</strong></div>
            <div><span>答案隐藏</span><strong>提交后显示</strong></div>
            <div><span>题型框架</span><strong>3 类</strong></div>
          </div>
          <div className="board-footer">
            <span>PDF 原图优先</span>
            <span>题号 1-1 至 1-99</span>
          </div>
        </aside>
      </section>

      <section className="structure-section" id="structure">
        <span className="eyebrow">QUESTION BANK</span>
        <h2>题库结构</h2>
        <div className="structure-grid">
          <article>
            <span>01</span>
            <h3>分类刷题</h3>
            <p>图形推理已开放；案例分析和文字推理保留扩展框架。</p>
          </article>
          <article>
            <span>02</span>
            <h3>图形推理</h3>
            <p>随机刷题与按考点刷题两种方式，覆盖题库1全部 99 题。</p>
          </article>
          <article>
            <span>03</span>
            <h3>考试模拟</h3>
            <p>框架已建立，待更多题型与大厂历年题补齐后开放。</p>
          </article>
        </div>
      </section>
    </main>
  );
}
