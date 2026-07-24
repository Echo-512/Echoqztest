"use client";

import { useEffect, useMemo, useState } from "react";
import questionData from "./questions.json";
import materialQuestionData from "./material-questions.json";

type Difficulty = "入门" | "提高" | "强化";
type Screen =
  | "home"
  | "categories"
  | "mode"
  | "practice"
  | "material-practice"
  | "mock"
  | "result"
  | "material-result";

type Question = {
  sourceId: string;
  image: string;
  optionImages: string[];
  answer: string;
  optionCount: number;
  point: string;
  difficulty: Difficulty;
  finePoints: string[];
  analysis: string;
  method: string;
  source: "题库1" | "题库2";
  originalNumber: number;
};

type SavedSession = {
  questionIds: string[];
  current: number;
  selected: Record<string, string>;
  submitted: Record<string, string>;
  questionTimes: Record<string, number>;
  currentSeconds: number;
};

type MaterialQuestion = {
  sourceId: string;
  image: string | null;
  prompt: string;
  options: string[];
  answer: string;
  optionCount: number;
  difficulty: Difficulty;
  analysis: string;
  sourceOccurrence: number;
};

const questions = questionData as Question[];
const materialQuestions = materialQuestionData as MaterialQuestion[];
const questionById = new Map(questions.map((question) => [question.sourceId, question]));
const materialQuestionById = new Map(
  materialQuestions.map((question) => [question.sourceId, question]),
);
const pointOrder = ["位置规律", "样式规律", "属性规律", "数量规律", "特殊规律"];
const letters = ["A", "B", "C", "D", "E", "F"];
const storageKey = "qiuzhao-xingce-graphic-session-v1";
const materialStorageKey = "qiuzhao-xingce-material-session-v1";

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
        <button type="button" onClick={onHome}>首页</button>
        <span>北森题库 · 图形推理 / 材料分析</span>
      </div>
      <button className="nav-cta" type="button" onClick={onPractice}>开始刷题</button>
    </nav>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [practiceQuestions, setPracticeQuestions] = useState<Question[]>(questions);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Record<string, string>>({});
  const [questionTimes, setQuestionTimes] = useState<Record<string, number>>({});
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [savedSession, setSavedSession] = useState<SavedSession | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [materialCurrent, setMaterialCurrent] = useState(0);
  const [materialSelected, setMaterialSelected] = useState<Record<string, string>>({});
  const [materialSubmitted, setMaterialSubmitted] = useState<Record<string, string>>({});
  const [materialQuestionTimes, setMaterialQuestionTimes] = useState<Record<string, number>>({});
  const [materialCurrentSeconds, setMaterialCurrentSeconds] = useState(0);
  const [savedMaterialSession, setSavedMaterialSession] = useState<SavedSession | null>(null);
  const [materialSessionActive, setMaterialSessionActive] = useState(false);

  const activeQuestion = practiceQuestions[current] ?? questions[0];
  const activeId = activeQuestion.sourceId;
  const answered = Boolean(submitted[activeId]);
  const activeMaterialQuestion =
    materialQuestions[materialCurrent] ?? materialQuestions[0];
  const activeMaterialId = activeMaterialQuestion.sourceId;
  const materialAnswered = Boolean(materialSubmitted[activeMaterialId]);

  const correctCount = useMemo(
    () =>
      practiceQuestions.filter(
        (question) =>
          submitted[question.sourceId] &&
          submitted[question.sourceId] === question.answer,
      ).length,
    [practiceQuestions, submitted],
  );
  const totalRecordedSeconds = useMemo(
    () => Object.values(questionTimes).reduce((sum, value) => sum + value, 0),
    [questionTimes],
  );
  const materialCorrectCount = useMemo(
    () =>
      materialQuestions.filter(
        (question) =>
          materialSubmitted[question.sourceId] &&
          materialSubmitted[question.sourceId] === question.answer,
      ).length,
    [materialSubmitted],
  );
  const materialTotalRecordedSeconds = useMemo(
    () =>
      Object.values(materialQuestionTimes).reduce(
        (sum, value) => sum + value,
        0,
      ),
    [materialQuestionTimes],
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedSession;
      const validIds = parsed.questionIds?.filter((id) => questionById.has(id)) ?? [];
      if (!validIds.length) return;
      setSavedSession({ ...parsed, questionIds: validIds });
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(materialStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedSession;
      const validIds =
        parsed.questionIds?.filter((id) => materialQuestionById.has(id)) ?? [];
      if (!validIds.length) return;
      setSavedMaterialSession({ ...parsed, questionIds: validIds });
    } catch {
      window.localStorage.removeItem(materialStorageKey);
    }
  }, []);

  useEffect(() => {
    if (screen !== "practice" || answered) return;
    const timer = window.setInterval(() => setCurrentSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [screen, answered, activeId]);

  useEffect(() => {
    if (screen !== "material-practice" || materialAnswered) return;
    const timer = window.setInterval(
      () => setMaterialCurrentSeconds((value) => value + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [screen, materialAnswered, activeMaterialId]);

  useEffect(() => {
    if (!sessionActive || !practiceQuestions.length) return;
    const snapshot: SavedSession = {
      questionIds: practiceQuestions.map((question) => question.sourceId),
      current,
      selected,
      submitted,
      questionTimes,
      currentSeconds,
    };
    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
    setSavedSession(snapshot);
  }, [
    sessionActive,
    practiceQuestions,
    current,
    selected,
    submitted,
    questionTimes,
    currentSeconds,
  ]);

  useEffect(() => {
    if (!materialSessionActive || !materialQuestions.length) return;
    const snapshot: SavedSession = {
      questionIds: materialQuestions.map((question) => question.sourceId),
      current: materialCurrent,
      selected: materialSelected,
      submitted: materialSubmitted,
      questionTimes: materialQuestionTimes,
      currentSeconds: materialCurrentSeconds,
    };
    window.localStorage.setItem(materialStorageKey, JSON.stringify(snapshot));
    setSavedMaterialSession(snapshot);
  }, [
    materialSessionActive,
    materialCurrent,
    materialSelected,
    materialSubmitted,
    materialQuestionTimes,
    materialCurrentSeconds,
  ]);

  function goHome() {
    setScreen("home");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goTo(nextScreen: Screen) {
    setScreen(nextScreen);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startPractice(pool: Question[]) {
    setPracticeQuestions(pool);
    setCurrent(0);
    setSelected({});
    setSubmitted({});
    setQuestionTimes({});
    setCurrentSeconds(0);
    setSessionActive(true);
    goTo("practice");
  }

  function resumePractice() {
    if (!savedSession) return;
    const pool = savedSession.questionIds
      .map((id) => questionById.get(id))
      .filter((question): question is Question => Boolean(question));
    if (!pool.length) return;
    setPracticeQuestions(pool);
    setCurrent(Math.min(savedSession.current, pool.length - 1));
    setSelected(savedSession.selected ?? {});
    setSubmitted(savedSession.submitted ?? {});
    setQuestionTimes(savedSession.questionTimes ?? {});
    setCurrentSeconds(savedSession.currentSeconds ?? 0);
    setSessionActive(true);
    goTo("practice");
  }

  function startMaterialPractice(reset = false) {
    if (!reset && savedMaterialSession) {
      const validCurrent = Math.min(
        savedMaterialSession.current,
        materialQuestions.length - 1,
      );
      setMaterialCurrent(validCurrent);
      setMaterialSelected(savedMaterialSession.selected ?? {});
      setMaterialSubmitted(savedMaterialSession.submitted ?? {});
      setMaterialQuestionTimes(savedMaterialSession.questionTimes ?? {});
      setMaterialCurrentSeconds(savedMaterialSession.currentSeconds ?? 0);
    } else {
      setMaterialCurrent(0);
      setMaterialSelected({});
      setMaterialSubmitted({});
      setMaterialQuestionTimes({});
      setMaterialCurrentSeconds(0);
    }
    setMaterialSessionActive(true);
    goTo("material-practice");
  }

  function chooseAnswer(letter: string) {
    if (answered) return;
    setSelected((state) => ({ ...state, [activeId]: letter }));
  }

  function submitAnswer() {
    const choice = selected[activeId];
    if (!choice || answered) return;
    setSubmitted((state) => ({ ...state, [activeId]: choice }));
    setQuestionTimes((state) => ({ ...state, [activeId]: currentSeconds }));
  }

  function nextQuestion() {
    if (current >= practiceQuestions.length - 1) {
      goTo("result");
      return;
    }
    const next = current + 1;
    const nextId = practiceQuestions[next].sourceId;
    setCurrent(next);
    setCurrentSeconds(questionTimes[nextId] ?? 0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function chooseMaterialAnswer(letter: string) {
    if (materialAnswered) return;
    setMaterialSelected((state) => ({
      ...state,
      [activeMaterialId]: letter,
    }));
  }

  function submitMaterialAnswer() {
    const choice = materialSelected[activeMaterialId];
    if (!choice || materialAnswered) return;
    setMaterialSubmitted((state) => ({
      ...state,
      [activeMaterialId]: choice,
    }));
    setMaterialQuestionTimes((state) => ({
      ...state,
      [activeMaterialId]: materialCurrentSeconds,
    }));
  }

  function nextMaterialQuestion() {
    if (materialCurrent >= materialQuestions.length - 1) {
      goTo("material-result");
      return;
    }
    const next = materialCurrent + 1;
    const nextId = materialQuestions[next].sourceId;
    setMaterialCurrent(next);
    setMaterialCurrentSeconds(materialQuestionTimes[nextId] ?? 0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (screen === "categories") {
    return (
      <main className="inner-page">
        <SiteNav onHome={goHome} onPractice={() => goTo("categories")} />
        <section className="page-heading">
          <button className="back-link" type="button" onClick={goHome}>← 返回首页</button>
          <span className="eyebrow">CATEGORY PRACTICE</span>
          <h1>选择题型</h1>
          <p>图形推理可随机或按考点练习；材料分析按原题顺序直接开始。</p>
        </section>
        <section className="category-grid">
          <button className="category-card active-card" type="button" onClick={() => goTo("mode")}>
            <span>01</span>
            <h2>图形推理</h2>
            <p>北森题库去重后共 {questions.length} 题，保留 Excel 原题号。</p>
            <strong>进入题库 →</strong>
          </button>
          <button
            className="category-card active-card material-category-card"
            type="button"
            onClick={() => startMaterialPractice(false)}
          >
            <span>02</span><h2>材料分析</h2>
            <p>北森图表分析去重后共 {materialQuestions.length} 题，按原题顺序练习。</p>
            <strong>
              {savedMaterialSession
                ? `继续上次进度 · 已完成 ${Object.keys(savedMaterialSession.submitted ?? {}).length} 题 →`
                : "进入题库 →"}
            </strong>
          </button>
          <article className="category-card muted-card">
            <span>03</span><h2>文字推理</h2>
            <p>题库框架已预留，资料补充后开放。</p><strong>即将更新</strong>
          </article>
        </section>
      </main>
    );
  }

  if (screen === "mode") {
    return (
      <main className="inner-page">
        <SiteNav onHome={goHome} onPractice={() => goTo("categories")} />
        <section className="page-heading compact-heading">
          <button className="back-link" type="button" onClick={() => goTo("categories")}>← 返回题型</button>
          <span className="eyebrow">GRAPHIC REASONING</span>
          <h1>图形推理怎么练？</h1>
          <p>随机进入真实节奏，或按大类集中训练薄弱考点。</p>
          {savedSession && (
            <button className="resume-mode" type="button" onClick={resumePractice}>
              继续上次刷题 · 已完成 {Object.keys(savedSession.submitted ?? {}).length} 题 →
            </button>
          )}
        </section>
        <section className="mode-grid">
          <button className="mode-card featured-mode" type="button" onClick={() => startPractice(shuffle(questions))}>
            <span className="mode-number">01</span>
            <h2>随机刷题</h2>
            <p>打乱全部 {questions.length} 道去重题，逐题计时、提交后判题。</p>
            <strong>开始随机刷题 →</strong>
          </button>
          <article className="mode-card">
            <span className="mode-number">02</span>
            <h2>按考点刷题</h2>
            <p>先按大类进入，提交后再显示二级、三级考点。</p>
            <div className="point-buttons">
              {pointOrder.map((point) => {
                const pool = questions.filter((question) => question.point === point);
                return (
                  <button key={point} type="button" onClick={() => startPractice(pool)}>
                    <span>{point}</span><small>{pool.length} 题</small>
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
        <SiteNav onHome={goHome} onPractice={() => goTo("categories")} />
        <section className="empty-state">
          <button className="back-link" type="button" onClick={goHome}>← 返回首页</button>
          <span className="eyebrow">MOCK EXAM</span>
          <h1>模考框架已经搭好</h1>
          <p>待文字推理和更多大厂真题加入后，将开放整卷倒计时、统一交卷和成绩报告。</p>
          <button className="primary-button" type="button" onClick={() => goTo("categories")}>先去分类刷题</button>
        </section>
      </main>
    );
  }

  if (screen === "practice") {
    const choice = selected[activeId];
    const isCorrect = submitted[activeId] === activeQuestion.answer;
    const optionImages = activeQuestion.optionImages ?? [];
    const visibleOptionCount = Math.max(
      activeQuestion.optionCount,
      optionImages.length,
      letters.indexOf(activeQuestion.answer) + 1,
    );
    return (
      <main className="practice-shell">
        <header className="practice-header">
          <button className="practice-back" type="button" onClick={() => goTo("mode")}>← 返回练习方式</button>
          <button className="logo light-logo" type="button" onClick={goHome}>
            <span className="logo-mark">Q</span>秋招行测
          </button>
          <div className="practice-progress">
            <span>{activeQuestion.source} · {current + 1}/{practiceQuestions.length}</span>
            <div><i style={{ width: `${((current + 1) / practiceQuestions.length) * 100}%` }} /></div>
          </div>
          <div className="timer" aria-label={`本题用时 ${formatTime(currentSeconds)}`}>
            <small>{answered ? "本题用时" : "本题计时"}</small>
            <strong>{formatTime(questionTimes[activeId] ?? currentSeconds)}</strong>
          </div>
        </header>

        <section className="practice-content">
          <div className="question-meta">
            <span>{activeQuestion.sourceId}</span>
            <span>{activeQuestion.difficulty}</span>
            <em>提交前不会显示答案</em>
          </div>
          <article className="question-card">
            <div className={`source-image-wrap ${optionImages.length ? "stem-image-wrap" : ""}`}>
              <img src={activeQuestion.image} alt={`${activeId} 图形推理题原图`} draggable={false} />
            </div>

            {optionImages.length ? (
              <div className="source-options" aria-label="请选择答案">
                {optionImages.map((image, index) => {
                  const letter = letters[index];
                  const chosen = choice === letter;
                  const stateClass = answered
                    ? letter === activeQuestion.answer
                      ? "correct-choice"
                      : chosen ? "wrong-choice" : ""
                    : chosen ? "selected-choice" : "";
                  return (
                    <button
                      key={image}
                      type="button"
                      className={`source-option-button ${stateClass}`}
                      onClick={() => chooseAnswer(letter)}
                      disabled={answered}
                    >
                      <span>{letter}</span>
                      <img src={image} alt={`选项 ${letter}`} draggable={false} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="answer-zone" aria-label="请选择答案">
                <p>选择你的答案</p>
                <div className="answer-buttons">
                  {letters.slice(0, visibleOptionCount).map((letter) => {
                    const chosen = choice === letter;
                    const stateClass = answered
                      ? letter === activeQuestion.answer
                        ? "correct-choice"
                        : chosen ? "wrong-choice" : ""
                      : chosen ? "selected-choice" : "";
                    return (
                      <button
                        key={letter}
                        type="button"
                        className={stateClass}
                        onClick={() => chooseAnswer(letter)}
                        disabled={answered}
                      >
                        {letter}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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
                <small>本题用时 {formatTime(questionTimes[activeId] ?? currentSeconds)}</small>
              </div>
              <div className="analysis-body">
                <h2>解析</h2><p>{activeQuestion.analysis}</p>
                <h3>快速识别</h3><p>{activeQuestion.method}</p>
                <div className="concept-tags">
                  <span>{activeQuestion.point}</span>
                  {activeQuestion.finePoints.map((point) => <span key={point}>{point}</span>)}
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

  if (screen === "material-practice") {
    const choice = materialSelected[activeMaterialId];
    const isCorrect =
      materialSubmitted[activeMaterialId] === activeMaterialQuestion.answer;
    const visibleOptionCount = Math.max(
      activeMaterialQuestion.optionCount,
      activeMaterialQuestion.options.length,
      letters.indexOf(activeMaterialQuestion.answer) + 1,
    );
    return (
      <main className="practice-shell material-practice-shell">
        <header className="practice-header">
          <button
            className="practice-back"
            type="button"
            onClick={() => goTo("categories")}
          >
            ← 返回题型
          </button>
          <button className="logo light-logo" type="button" onClick={goHome}>
            <span className="logo-mark">Q</span>秋招行测
          </button>
          <div className="practice-progress">
            <span>
              材料分析 · {materialCurrent + 1}/{materialQuestions.length}
            </span>
            <div>
              <i
                style={{
                  width: `${((materialCurrent + 1) / materialQuestions.length) * 100}%`,
                }}
              />
            </div>
          </div>
          <div
            className="timer"
            aria-label={`本题用时 ${formatTime(materialCurrentSeconds)}`}
          >
            <small>{materialAnswered ? "本题用时" : "本题计时"}</small>
            <strong>
              {formatTime(
                materialQuestionTimes[activeMaterialId] ??
                  materialCurrentSeconds,
              )}
            </strong>
          </div>
        </header>

        <section className="practice-content">
          <div className="question-meta">
            <span>{activeMaterialQuestion.sourceId}</span>
            <span>{activeMaterialQuestion.difficulty}</span>
            <em>提交前不会显示答案</em>
          </div>
          <article className="question-card material-question-card">
            <p className="material-prompt">
              {activeMaterialQuestion.prompt}
            </p>
            {activeMaterialQuestion.image && (
              <div className="source-image-wrap material-chart-wrap">
                <img
                  src={activeMaterialQuestion.image}
                  alt={`${activeMaterialId} 原 PDF 图表`}
                  draggable={false}
                />
              </div>
            )}
            <div className="material-options" aria-label="请选择答案">
              {letters.slice(0, visibleOptionCount).map((letter, index) => {
                const chosen = choice === letter;
                const stateClass = materialAnswered
                  ? letter === activeMaterialQuestion.answer
                    ? "correct-choice"
                    : chosen
                      ? "wrong-choice"
                      : ""
                  : chosen
                    ? "selected-choice"
                    : "";
                const optionText =
                  activeMaterialQuestion.options[index] ?? "以上说法";
                return (
                  <button
                    key={letter}
                    type="button"
                    className={`material-option-button ${stateClass}`}
                    onClick={() => chooseMaterialAnswer(letter)}
                    disabled={materialAnswered}
                  >
                    <strong>{letter}</strong>
                    <span>{optionText}</span>
                  </button>
                );
              })}
            </div>
          </article>

          {!materialAnswered ? (
            <button
              className="submit-button"
              type="button"
              onClick={submitMaterialAnswer}
              disabled={!choice}
            >
              确认提交
            </button>
          ) : (
            <section
              className={`analysis-card ${isCorrect ? "analysis-correct" : "analysis-wrong"}`}
            >
              <div className="analysis-result">
                <span>{isCorrect ? "回答正确" : "回答错误"}</span>
                <strong>正确答案：{activeMaterialQuestion.answer}</strong>
                <small>
                  本题用时{" "}
                  {formatTime(
                    materialQuestionTimes[activeMaterialId] ??
                      materialCurrentSeconds,
                  )}
                </small>
              </div>
              <div className="analysis-body">
                <h2>解析</h2>
                {activeMaterialQuestion.analysis
                  .split("\n")
                  .filter(Boolean)
                  .map((paragraph, index) => (
                    <p key={`${activeMaterialId}-analysis-${index}`}>
                      {paragraph}
                    </p>
                  ))}
              </div>
              <button
                className="next-button"
                type="button"
                onClick={nextMaterialQuestion}
              >
                {materialCurrent === materialQuestions.length - 1
                  ? "查看成绩"
                  : "下一题 →"}
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
        <SiteNav onHome={goHome} onPractice={() => goTo("categories")} />
        <section className="result-card">
          <button className="back-link" type="button" onClick={() => goTo("mode")}>← 返回练习方式</button>
          <span className="eyebrow">SESSION COMPLETE</span>
          <h1>{correctCount} / {answeredCount}</h1>
          <p>本次累计答题用时 {formatTime(totalRecordedSeconds)}。进度已经保存在本机，可随时继续。</p>
          <div>
            <button className="primary-button" type="button" onClick={() => startPractice(shuffle(questions))}>再刷一轮</button>
            <button className="text-button" type="button" onClick={goHome}>返回首页</button>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "material-result") {
    const answeredCount = Object.keys(materialSubmitted).length;
    return (
      <main className="inner-page">
        <SiteNav onHome={goHome} onPractice={() => goTo("categories")} />
        <section className="result-card">
          <button
            className="back-link"
            type="button"
            onClick={() => goTo("categories")}
          >
            ← 返回题型
          </button>
          <span className="eyebrow">MATERIAL SESSION COMPLETE</span>
          <h1>{materialCorrectCount} / {answeredCount}</h1>
          <p>
            本次累计答题用时 {formatTime(materialTotalRecordedSeconds)}
            。材料分析进度已经保存在本机。
          </p>
          <div>
            <button
              className="primary-button"
              type="button"
              onClick={() => startMaterialPractice(true)}
            >
              重新开始
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => goTo("categories")}
            >
              返回题型
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="home-page">
      <SiteNav onHome={goHome} onPractice={() => goTo("categories")} />
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-label">FOR 2026 AUTUMN RECRUITMENT</span>
          <h1>大厂行测，<br />终于有地方<span>练了</span></h1>
          <p>为秋招学生做的行测刷题站。图形推理与材料分析已开放，不套用考公节奏，只练大厂笔试真正会遇到的题。</p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => goTo("categories")}>进入分类刷题 →</button>
            <button className="primary-button secondary-green" type="button" onClick={() => goTo("mock")}>进入模考 →</button>
            <a href="#structure">看看题库结构</a>
          </div>
        </div>
        <aside className="hero-board" aria-label="题库概览">
          <div className="board-top"><span>北森题库 · 图形推理</span><em>持续更新</em></div>
          <div className="board-score">
            <div><span>去重后已录入</span><strong>{questions.length}</strong><small>题库1 + 题库2</small></div>
            <div className="mini-chart" aria-hidden="true">
              {[48, 67, 54, 82, 72, 92, 78].map((height) => <i key={height} style={{ height: `${height}%` }} />)}
            </div>
          </div>
          <div className="board-progress">
            <div><span>题库2清晰图</span><strong>195 题</strong></div>
            <div><span>题库1独有题</span><strong>52 题</strong></div>
            <div><span>答案隐藏</span><strong>提交后显示</strong></div>
          </div>
          <div className="board-footer"><span>PDF 原图优先</span><span>保留 Excel 原题号</span></div>
        </aside>
      </section>

      <section className="structure-section" id="structure">
        <span className="eyebrow">QUESTION BANK</span><h2>题库结构</h2>
        <div className="structure-grid">
          <article><span>01</span><h3>分类刷题</h3><p>图形推理与材料分析已开放；文字推理保留扩展框架。</p></article>
          <article><span>02</span><h3>图形推理</h3><p>随机刷题与按考点刷题，覆盖两套北森资料去重后的 {questions.length} 道题。</p></article>
          <article><span>03</span><h3>材料分析</h3><p>按原题顺序练习 {materialQuestions.length} 道去重题，题干与选项清晰排版，图表保留 PDF 原图。</p></article>
          <article><span>04</span><h3>考试模拟</h3><p>框架已建立，待更多题型与大厂历年题补齐后开放。</p></article>
        </div>
      </section>
    </main>
  );
}
