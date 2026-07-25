"use client";

import { useEffect, useMemo, useState } from "react";
import materialQuestionData from "./material-questions.json";
import questionData from "./questions.json";
import verbalQuestionData from "./verbal-questions.json";

type Difficulty = "入门" | "提高" | "强化";
type ModuleKey = "graphic" | "material" | "verbal";
type PracticeContext = "normal" | "wrong";
type Screen =
  | "home"
  | "categories"
  | "graphic-mode"
  | "verbal-mode"
  | "mock"
  | "practice"
  | "result"
  | "wrong-categories"
  | "wrong-dashboard";

type GraphicQuestion = {
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

type VerbalQuestion = {
  sourceId: string;
  sourceOccurrence: number;
  duplicateOccurrences: number[];
  prompt: string;
  options: string[];
  answer: string;
  optionCount: number;
  category: string;
  point: string;
  difficulty: Difficulty;
  analysis: string;
  method: string;
  analysisSource: "原题解析" | "依据讲义补充";
};

type BankQuestion = GraphicQuestion | MaterialQuestion | VerbalQuestion;

type SavedSession = {
  module: ModuleKey;
  context: PracticeContext;
  questionIds: string[];
  current: number;
  selected: Record<string, string>;
  submitted: Record<string, string>;
  questionTimes: Record<string, number>;
  currentSeconds: number;
};

type ModulePerformance = {
  attempts: number;
  correct: number;
  wrongIds: string[];
};

type PerformanceState = Record<ModuleKey, ModulePerformance>;

const questions = questionData as GraphicQuestion[];
const materialQuestions = materialQuestionData as MaterialQuestion[];
const verbalQuestions = verbalQuestionData as VerbalQuestion[];
const graphicById = new Map(questions.map((question) => [question.sourceId, question]));
const materialById = new Map(
  materialQuestions.map((question) => [question.sourceId, question]),
);
const verbalById = new Map(
  verbalQuestions.map((question) => [question.sourceId, question]),
);
const pointOrder = ["位置规律", "样式规律", "属性规律", "数量规律", "特殊规律"];
const verbalCategoryOrder = [
  "中心理解题",
  "标题填入题",
  "细节判断题",
  "词句理解题",
  "语句排序题",
  "语句填空题",
  "接语推断题",
  "逻辑填空",
  "其他文字推理",
];
const letters = ["A", "B", "C", "D", "E", "F"];
const sessionStorageKeys: Record<`${ModuleKey}-${PracticeContext}`, string> = {
  "graphic-normal": "qiuzhao-xingce-graphic-session-v1",
  "graphic-wrong": "qiuzhao-xingce-graphic-wrong-session-v1",
  "material-normal": "qiuzhao-xingce-material-session-v1",
  "material-wrong": "qiuzhao-xingce-material-wrong-session-v1",
  "verbal-normal": "qiuzhao-xingce-verbal-session-v1",
  "verbal-wrong": "qiuzhao-xingce-verbal-wrong-session-v1",
};
const performanceStorageKey = "qiuzhao-xingce-performance-v1";
const initialPerformance: PerformanceState = {
  graphic: { attempts: 0, correct: 0, wrongIds: [] },
  material: { attempts: 0, correct: 0, wrongIds: [] },
  verbal: { attempts: 0, correct: 0, wrongIds: [] },
};
const moduleNames: Record<ModuleKey, string> = {
  graphic: "图形推理",
  material: "材料分析",
  verbal: "文字推理",
};
const pieColors = ["#174c40", "#4e8b78", "#85b9a5", "#f0c85b", "#b96a5d", "#7e8d86"];

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

function storageKey(module: ModuleKey, context: PracticeContext) {
  return sessionStorageKeys[`${module}-${context}`];
}

function bankFor(module: ModuleKey): BankQuestion[] {
  if (module === "graphic") return questions;
  if (module === "material") return materialQuestions;
  return verbalQuestions;
}

function questionFor(module: ModuleKey, sourceId: string) {
  if (module === "graphic") return graphicById.get(sourceId);
  if (module === "material") return materialById.get(sourceId);
  return verbalById.get(sourceId);
}

function answerFor(question: BankQuestion) {
  return question.answer;
}

function emptySession(module: ModuleKey, context: PracticeContext, pool: BankQuestion[]): SavedSession {
  return {
    module,
    context,
    questionIds: pool.map((question) => question.sourceId),
    current: 0,
    selected: {},
    submitted: {},
    questionTimes: {},
    currentSeconds: 0,
  };
}

function mergePerformance(value: unknown): PerformanceState {
  if (!value || typeof value !== "object") return initialPerformance;
  const parsed = value as Partial<PerformanceState>;
  return {
    graphic: {
      attempts: parsed.graphic?.attempts ?? 0,
      correct: parsed.graphic?.correct ?? 0,
      wrongIds: parsed.graphic?.wrongIds?.filter((id) => graphicById.has(id)) ?? [],
    },
    material: {
      attempts: parsed.material?.attempts ?? 0,
      correct: parsed.material?.correct ?? 0,
      wrongIds: parsed.material?.wrongIds?.filter((id) => materialById.has(id)) ?? [],
    },
    verbal: {
      attempts: parsed.verbal?.attempts ?? 0,
      correct: parsed.verbal?.correct ?? 0,
      wrongIds: parsed.verbal?.wrongIds?.filter((id) => verbalById.has(id)) ?? [],
    },
  };
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
        <span>北森题库 · 图形推理 / 材料分析 / 文字推理</span>
      </div>
      <button className="nav-cta" type="button" onClick={onPractice}>开始刷题</button>
    </nav>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [activeSession, setActiveSession] = useState<SavedSession | null>(null);
  const [savedSessions, setSavedSessions] = useState<Record<string, SavedSession>>({});
  const [performance, setPerformance] = useState<PerformanceState>(initialPerformance);
  const [persistenceLoaded, setPersistenceLoaded] = useState(false);
  const [wrongModule, setWrongModule] = useState<ModuleKey>("graphic");

  const activeId =
    activeSession?.questionIds[activeSession.current] ?? questions[0].sourceId;
  const activeQuestion = activeSession
    ? questionFor(activeSession.module, activeId)
    : questions[0];
  const answered = Boolean(activeSession?.submitted[activeId]);
  const activeModule = activeSession?.module;

  const savedGraphic =
    activeSession?.module === "graphic" && activeSession.context === "normal"
      ? activeSession
      : savedSessions[storageKey("graphic", "normal")];
  const savedMaterial =
    activeSession?.module === "material" && activeSession.context === "normal"
      ? activeSession
      : savedSessions[storageKey("material", "normal")];
  const savedVerbal =
    activeSession?.module === "verbal" && activeSession.context === "normal"
      ? activeSession
      : savedSessions[storageKey("verbal", "normal")];

  useEffect(() => {
    const loadedSessions: Record<string, SavedSession> = {};
    for (const key of Object.values(sessionStorageKeys)) {
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as SavedSession;
        const validIds =
          parsed.questionIds?.filter((id) => Boolean(questionFor(parsed.module, id))) ?? [];
        if (!validIds.length) continue;
        loadedSessions[key] = { ...parsed, questionIds: validIds };
      } catch {
        window.localStorage.removeItem(key);
      }
    }
    window.setTimeout(() => {
      setSavedSessions(loadedSessions);
      try {
        const raw = window.localStorage.getItem(performanceStorageKey);
        if (raw) setPerformance(mergePerformance(JSON.parse(raw)));
      } catch {
        window.localStorage.removeItem(performanceStorageKey);
      }
      setPersistenceLoaded(true);
    }, 0);
  }, []);

  useEffect(() => {
    if (!persistenceLoaded) return;
    window.localStorage.setItem(performanceStorageKey, JSON.stringify(performance));
  }, [performance, persistenceLoaded]);

  useEffect(() => {
    if (!activeSession || !persistenceLoaded) return;
    const key = storageKey(activeSession.module, activeSession.context);
    window.localStorage.setItem(key, JSON.stringify(activeSession));
  }, [activeSession, persistenceLoaded]);

  useEffect(() => {
    if (!activeSession) return;
    const flush = () => {
      window.localStorage.setItem(
        storageKey(activeSession.module, activeSession.context),
        JSON.stringify(activeSession),
      );
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [activeSession]);

  useEffect(() => {
    if (screen !== "practice" || answered || !activeModule) return;
    const timer = window.setInterval(() => {
      setActiveSession((session) =>
        session ? { ...session, currentSeconds: session.currentSeconds + 1 } : session,
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [screen, answered, activeId, activeModule]);

  function goHome() {
    setScreen("home");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goTo(nextScreen: Screen) {
    setScreen(nextScreen);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startSession(
    module: ModuleKey,
    pool: BankQuestion[],
    context: PracticeContext = "normal",
  ) {
    if (!pool.length) return;
    setActiveSession(emptySession(module, context, pool));
    goTo("practice");
  }

  function resumeSession(
    module: ModuleKey,
    context: PracticeContext = "normal",
    allowedIds?: Set<string>,
  ) {
    let saved = savedSessions[storageKey(module, context)];
    try {
      const raw = window.localStorage.getItem(storageKey(module, context));
      if (raw) saved = JSON.parse(raw) as SavedSession;
    } catch {
      window.localStorage.removeItem(storageKey(module, context));
    }
    if (!saved) return false;
    const currentSourceId = saved.questionIds[saved.current];
    const validIds = saved.questionIds.filter(
      (id) => Boolean(questionFor(module, id)) && (!allowedIds || allowedIds.has(id)),
    );
    if (!validIds.length) return false;
    const currentIndex = validIds.indexOf(currentSourceId);
    const current = currentIndex >= 0 ? currentIndex : Math.min(saved.current, validIds.length - 1);
    setActiveSession({ ...saved, module, context, questionIds: validIds, current });
    goTo("practice");
    return true;
  }

  function startPractice(pool: GraphicQuestion[]) {
    startSession("graphic", pool);
  }

  function resumePractice() {
    resumeSession("graphic");
  }

  function startMaterialPractice(reset = false) {
    if (!reset && resumeSession("material")) return;
    startSession("material", materialQuestions);
  }

  function startVerbalPractice(pool: VerbalQuestion[]) {
    startSession("verbal", pool);
  }

  function resumeVerbalPractice() {
    resumeSession("verbal");
  }

  function chooseAnswer(letter: string) {
    if (!activeSession || answered) return;
    setActiveSession({
      ...activeSession,
      selected: { ...activeSession.selected, [activeId]: letter },
    });
  }

  function recordAttempt(
    module: ModuleKey,
    sourceId: string,
    isCorrect: boolean,
    context: PracticeContext,
  ) {
    setPerformance((state) => {
      const previous = state[module];
      const wrongIds = new Set(previous.wrongIds);
      if (!isCorrect) wrongIds.add(sourceId);
      if (isCorrect && context === "wrong") wrongIds.delete(sourceId);
      return {
        ...state,
        [module]: {
          attempts: previous.attempts + 1,
          correct: previous.correct + (isCorrect ? 1 : 0),
          wrongIds: [...wrongIds],
        },
      };
    });
  }

  function submitCurrent() {
    if (!activeSession || !activeQuestion || answered) return;
    const choice = activeSession.selected[activeId];
    if (!choice) return;
    const isCorrect = choice === answerFor(activeQuestion);
    setActiveSession({
      ...activeSession,
      submitted: { ...activeSession.submitted, [activeId]: choice },
      questionTimes: {
        ...activeSession.questionTimes,
        [activeId]: activeSession.currentSeconds,
      },
    });
    recordAttempt(activeSession.module, activeId, isCorrect, activeSession.context);
  }

  function submitAnswer() {
    if (activeSession?.module === "graphic") submitCurrent();
  }

  function submitMaterialAnswer() {
    if (activeSession?.module === "material") submitCurrent();
  }

  function submitVerbalAnswer() {
    if (activeSession?.module === "verbal") submitCurrent();
  }

  function nextQuestion() {
    if (!activeSession) return;
    if (activeSession.current >= activeSession.questionIds.length - 1) {
      goTo("result");
      return;
    }
    const next = activeSession.current + 1;
    const nextId = activeSession.questionIds[next];
    setActiveSession({
      ...activeSession,
      current: next,
      currentSeconds: activeSession.questionTimes[nextId] ?? 0,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function practiceBackScreen() {
    if (activeSession?.context === "wrong") return "wrong-dashboard";
    if (activeSession?.module === "graphic") return "graphic-mode";
    if (activeSession?.module === "verbal") return "verbal-mode";
    return "categories";
  }

  function openWrongDashboard(module: ModuleKey) {
    setWrongModule(module);
    goTo("wrong-dashboard");
  }

  function startWrongPractice(module: ModuleKey) {
    const wrongIds = new Set(performance[module].wrongIds);
    if (!wrongIds.size) return;
    if (resumeSession(module, "wrong", wrongIds)) return;
    const pool = bankFor(module).filter((question) => wrongIds.has(question.sourceId));
    startSession(module, pool, "wrong");
  }

  const wrongQuestions = useMemo(
    () =>
      performance[wrongModule].wrongIds
        .map((id) => questionFor(wrongModule, id))
        .filter((question): question is BankQuestion => Boolean(question)),
    [performance, wrongModule],
  );

  const wrongCategoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const question of wrongQuestions) {
      let category = "材料分析";
      if (wrongModule === "graphic") category = (question as GraphicQuestion).point;
      if (wrongModule === "verbal") category = (question as VerbalQuestion).category;
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [wrongQuestions, wrongModule]);

  const weakWords = useMemo(() => {
    const counts = new Map<string, number>();
    if (wrongModule === "material") return [];
    for (const question of wrongQuestions) {
      const words =
        wrongModule === "graphic"
          ? [
              (question as GraphicQuestion).point,
              ...(question as GraphicQuestion).finePoints,
            ]
          : [
              (question as VerbalQuestion).category,
              (question as VerbalQuestion).point,
            ];
      for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 7);
  }, [wrongQuestions, wrongModule]);

  const pieGradient = useMemo(() => {
    if (!wrongCategoryCounts.length) return "conic-gradient(#e4e8e1 0 100%)";
    const total = wrongCategoryCounts.reduce((sum, [, count]) => sum + count, 0);
    let cursor = 0;
    const segments = wrongCategoryCounts.map(([, count], index) => {
      const start = cursor;
      cursor += (count / total) * 100;
      return `${pieColors[index % pieColors.length]} ${start}% ${cursor}%`;
    });
    return `conic-gradient(${segments.join(",")})`;
  }, [wrongCategoryCounts]);

  if (screen === "categories") {
    return (
      <main className="inner-page">
        <SiteNav onHome={goHome} onPractice={() => goTo("categories")} />
        <section className="page-heading">
          <button className="back-link" type="button" onClick={goHome}>← 返回首页</button>
          <span className="eyebrow">CATEGORY PRACTICE</span>
          <h1>选择题型</h1>
          <p>图形推理和文字推理支持随机/按类型练习；材料分析按原题顺序直接开始。</p>
        </section>
        <section className="category-grid">
          <button className="category-card active-card" type="button" onClick={() => goTo("graphic-mode")}>
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
              {savedMaterial
                ? `继续上次进度 · 已完成 ${Object.keys(savedMaterial.submitted ?? {}).length} 题 →`
                : "进入题库 →"}
            </strong>
          </button>
          <button className="category-card active-card" type="button" onClick={() => goTo("verbal-mode")}>
            <span>03</span><h2>文字推理</h2>
            <p>北森言语理解去重后共 {verbalQuestions.length} 题，均已标注题型、考点和难度。</p>
            <strong>进入题库 →</strong>
          </button>
        </section>
      </main>
    );
  }

  if (screen === "graphic-mode") {
    return (
      <main className="inner-page">
        <SiteNav onHome={goHome} onPractice={() => goTo("categories")} />
        <section className="page-heading compact-heading">
          <button className="back-link" type="button" onClick={() => goTo("categories")}>← 返回题型</button>
          <span className="eyebrow">GRAPHIC REASONING</span>
          <h1>图形推理怎么练？</h1>
          <p>随机进入真实节奏，或按大类集中训练薄弱考点。</p>
          {savedGraphic && (
            <button className="resume-mode" type="button" onClick={resumePractice}>
              继续上次刷题 · 已完成 {Object.keys(savedGraphic.submitted ?? {}).length} 题 →
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
            <p>先按大类进入，提交后再显示细化考点。</p>
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

  if (screen === "verbal-mode") {
    return (
      <main className="inner-page">
        <SiteNav onHome={goHome} onPractice={() => goTo("categories")} />
        <section className="page-heading compact-heading">
          <button className="back-link" type="button" onClick={() => goTo("categories")}>← 返回题型</button>
          <span className="eyebrow">VERBAL REASONING</span>
          <h1>文字推理怎么练？</h1>
          <p>题型依据配套讲义划分，提交后显示二级考点、答案与解析。</p>
          {savedVerbal && (
            <button className="resume-mode" type="button" onClick={resumeVerbalPractice}>
              继续上次刷题 · 已完成 {Object.keys(savedVerbal.submitted ?? {}).length} 题 →
            </button>
          )}
        </section>
        <section className="mode-grid">
          <button
            className="mode-card featured-mode"
            type="button"
            onClick={() => startVerbalPractice(shuffle(verbalQuestions))}
          >
            <span className="mode-number">01</span>
            <h2>随机刷题</h2>
            <p>打乱全部 {verbalQuestions.length} 道去重题，逐题计时并即时保存。</p>
            <strong>开始随机刷题 →</strong>
          </button>
          <article className="mode-card">
            <span className="mode-number">02</span>
            <h2>按类型刷题</h2>
            <p>按讲义大类进入，做完后查看细化考点。</p>
            <div className="point-buttons verbal-point-buttons">
              {verbalCategoryOrder.map((category) => {
                const pool = verbalQuestions.filter(
                  (question) => question.category === category,
                );
                if (!pool.length) return null;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => startVerbalPractice(pool)}
                  >
                    <span>{category}</span><small>{pool.length} 题</small>
                  </button>
                );
              })}
            </div>
          </article>
        </section>
      </main>
    );
  }

  if (screen === "wrong-categories") {
    return (
      <main className="inner-page">
        <SiteNav onHome={goHome} onPractice={() => goTo("categories")} />
        <section className="page-heading">
          <button className="back-link" type="button" onClick={goHome}>← 返回首页</button>
          <span className="eyebrow">WRONG ANSWER BOOK</span>
          <h1>选择错题分类</h1>
          <p>错题在每次提交后立即保存；在错题集里答对后会自动移出。</p>
        </section>
        <section className="category-grid">
          {(["graphic", "material", "verbal"] as ModuleKey[]).map((module, index) => (
            <button
              className="category-card active-card"
              type="button"
              key={module}
              onClick={() => openWrongDashboard(module)}
            >
              <span>0{index + 1}</span>
              <h2>{moduleNames[module]}</h2>
              <p>累计作答 {performance[module].attempts} 次，当前错题 {performance[module].wrongIds.length} 道。</p>
              <strong>查看评估与错题 →</strong>
            </button>
          ))}
        </section>
      </main>
    );
  }

  if (screen === "wrong-dashboard") {
    const stats = performance[wrongModule];
    const accuracy = stats.attempts
      ? Math.round((stats.correct / stats.attempts) * 100)
      : 0;
    return (
      <main className="inner-page">
        <SiteNav onHome={goHome} onPractice={() => goTo("categories")} />
        <section className="page-heading compact-heading">
          <button className="back-link" type="button" onClick={() => goTo("wrong-categories")}>← 返回错题分类</button>
          <span className="eyebrow">LEARNING REVIEW</span>
          <h1>{moduleNames[wrongModule]}错题评估</h1>
          <p>已刷 {stats.attempts} 题次，正确率 {accuracy}%，当前错题 {wrongQuestions.length} 道。</p>
        </section>
        <section className="wrong-dashboard">
          {wrongModule !== "material" && (
            <div className="wrong-analysis-grid">
              <article className="wrong-chart-card">
                <div className="wrong-pie" style={{ background: pieGradient }}>
                  <strong>{wrongQuestions.length}</strong><span>道错题</span>
                </div>
                <div className="wrong-legend">
                  <h2>错误题型占比</h2>
                  {wrongCategoryCounts.map(([category, count], index) => (
                    <p key={category}>
                      <i style={{ background: pieColors[index % pieColors.length] }} />
                      <span>{category}</span><strong>{count}</strong>
                    </p>
                  ))}
                </div>
              </article>
              <article className="weak-card">
                <span className="eyebrow">WEAK POINTS</span>
                <h2>薄弱环节词频</h2>
                {weakWords.length ? (
                  <div className="weak-tags">
                    {weakWords.map(([word, count]) => (
                      <span key={word}>{word}<em>{count}</em></span>
                    ))}
                  </div>
                ) : (
                  <p>完成几道题后，这里会自动归纳你的高频失分考点。</p>
                )}
              </article>
            </div>
          )}
          <article className="wrong-start-card">
            <div>
              <span className="eyebrow">RETRY</span>
              <h2>{wrongQuestions.length ? "从当前错题继续练习" : "暂时没有错题"}</h2>
              <p>
                {wrongQuestions.length
                  ? "答对的题会立即移出；以后正常练习再次答错，仍会自动加入。"
                  : "继续去分类刷题，答错后题目会立即出现在这里。"}
              </p>
            </div>
            <button
              className="primary-button"
              type="button"
              disabled={!wrongQuestions.length}
              onClick={() => startWrongPractice(wrongModule)}
            >
              进入错题集开始刷题 →
            </button>
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
          <p>待更多大厂历年题加入后，将开放整卷倒计时、统一交卷和成绩报告。</p>
          <button className="primary-button" type="button" onClick={() => goTo("categories")}>先去分类刷题</button>
        </section>
      </main>
    );
  }

  if (screen === "practice" && activeSession && activeQuestion) {
    const choice = activeSession.selected[activeId];
    const correctAnswer = answerFor(activeQuestion);
    const isCorrect = activeSession.submitted[activeId] === correctAnswer;
    const optionCount = activeQuestion.optionCount;
    const questionTime =
      activeSession.questionTimes[activeId] ?? activeSession.currentSeconds;

    const optionStateClass = (letter: string) => {
      const chosen = choice === letter;
      if (!answered) return chosen ? "selected-choice" : "";
      if (letter === correctAnswer) return "correct-choice";
      return chosen ? "wrong-choice" : "";
    };

    return (
      <main className="practice-shell">
        <header className="practice-header">
          <button className="practice-back" type="button" onClick={() => goTo(practiceBackScreen())}>
            ← 返回上一级
          </button>
          <button className="logo light-logo" type="button" onClick={goHome}>
            <span className="logo-mark">Q</span>秋招行测
          </button>
          <div className="practice-progress">
            <span>
              {activeSession.context === "wrong" ? "错题集 · " : ""}
              {moduleNames[activeSession.module]} · {activeSession.current + 1}/{activeSession.questionIds.length}
            </span>
            <div>
              <i
                style={{
                  width: `${((activeSession.current + 1) / activeSession.questionIds.length) * 100}%`,
                }}
              />
            </div>
          </div>
          <div className="timer" aria-label={`本题用时 ${formatTime(questionTime)}`}>
            <small>{answered ? "本题用时" : "本题计时"}</small>
            <strong>{formatTime(questionTime)}</strong>
          </div>
        </header>

        <section className="practice-content">
          <div className="question-meta">
            <span>{activeQuestion.sourceId}</span>
            <span>{activeQuestion.difficulty}</span>
            <em>提交前不会显示答案</em>
          </div>
          <article
            className={`question-card ${activeSession.module === "material" ? "material-question-card" : ""} ${activeSession.module === "verbal" ? "verbal-question-card" : ""}`}
          >
            {activeSession.module === "graphic" ? (
              <>
                <div
                  className={`source-image-wrap ${(activeQuestion as GraphicQuestion).optionImages.length ? "stem-image-wrap" : ""}`}
                >
                  <img
                    src={(activeQuestion as GraphicQuestion).image}
                    alt={`${activeId} 图形推理题原图`}
                    draggable={false}
                  />
                </div>
                {(activeQuestion as GraphicQuestion).optionImages.length === optionCount ? (
                  <div className="source-options" aria-label="请选择答案">
                    {(activeQuestion as GraphicQuestion).optionImages.map((image, index) => {
                      const letter = letters[index];
                      return (
                        <button
                          key={image}
                          type="button"
                          className={`source-option-button ${optionStateClass(letter)}`}
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
                      {letters.slice(0, optionCount).map((letter) => (
                        <button
                          key={letter}
                          type="button"
                          className={optionStateClass(letter)}
                          onClick={() => chooseAnswer(letter)}
                          disabled={answered}
                        >
                          {letter}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className={activeSession.module === "material" ? "material-prompt" : "verbal-prompt"}>
                  {(activeQuestion as MaterialQuestion | VerbalQuestion).prompt}
                </p>
                {activeSession.module === "material" &&
                  (activeQuestion as MaterialQuestion).image && (
                    <div className="source-image-wrap material-chart-wrap">
                      <img
                        src={(activeQuestion as MaterialQuestion).image ?? ""}
                        alt={`${activeId} 原 PDF 图表`}
                        draggable={false}
                      />
                    </div>
                  )}
                <div className="material-options" aria-label="请选择答案">
                  {(activeQuestion as MaterialQuestion | VerbalQuestion).options.map(
                    (option, index) => {
                      const letter = letters[index];
                      return (
                        <button
                          key={`${activeId}-${letter}`}
                          type="button"
                          className={`material-option-button ${optionStateClass(letter)}`}
                          onClick={() => chooseAnswer(letter)}
                          disabled={answered}
                        >
                          <strong>{letter}</strong><span>{option}</span>
                        </button>
                      );
                    },
                  )}
                </div>
              </>
            )}
          </article>

          {!answered ? (
            <button
              className="submit-button"
              type="button"
              onClick={
                activeSession.module === "graphic"
                  ? submitAnswer
                  : activeSession.module === "material"
                    ? submitMaterialAnswer
                    : submitVerbalAnswer
              }
              disabled={!choice}
            >
              确认提交
            </button>
          ) : (
            <section className={`analysis-card ${isCorrect ? "analysis-correct" : "analysis-wrong"}`}>
              <div className="analysis-result">
                <span>{isCorrect ? "回答正确" : "回答错误"}</span>
                <strong>正确答案：{correctAnswer}</strong>
                <small>本题用时 {formatTime(questionTime)}</small>
              </div>
              <div className="analysis-body">
                <h2>解析</h2>
                {activeQuestion.analysis
                  .split("\n")
                  .filter(Boolean)
                  .map((paragraph, index) => (
                    <p key={`${activeId}-analysis-${index}`}>{paragraph}</p>
                  ))}
                {activeSession.module === "graphic" && (
                  <>
                    <h3>快速识别</h3>
                    <p>{(activeQuestion as GraphicQuestion).method}</p>
                    <div className="concept-tags">
                      <span>{(activeQuestion as GraphicQuestion).point}</span>
                      {(activeQuestion as GraphicQuestion).finePoints.map((point) => (
                        <span key={point}>{point}</span>
                      ))}
                    </div>
                  </>
                )}
                {activeSession.module === "verbal" && (
                  <>
                    <h3>快速识别</h3>
                    <p>{(activeQuestion as VerbalQuestion).method}</p>
                    <div className="concept-tags">
                      <span>{(activeQuestion as VerbalQuestion).category}</span>
                      <span>{(activeQuestion as VerbalQuestion).point}</span>
                    </div>
                  </>
                )}
              </div>
              <button className="next-button" type="button" onClick={nextQuestion}>
                {activeSession.current === activeSession.questionIds.length - 1
                  ? "查看成绩"
                  : "下一题 →"}
              </button>
            </section>
          )}
        </section>
      </main>
    );
  }

  if (screen === "result" && activeSession) {
    const answeredIds = Object.keys(activeSession.submitted);
    const correctCount = answeredIds.filter((id) => {
      const question = questionFor(activeSession.module, id);
      return question && activeSession.submitted[id] === question.answer;
    }).length;
    const totalSeconds = Object.values(activeSession.questionTimes).reduce(
      (sum, value) => sum + value,
      0,
    );
    return (
      <main className="inner-page">
        <SiteNav onHome={goHome} onPractice={() => goTo("categories")} />
        <section className="result-card">
          <button className="back-link" type="button" onClick={() => goTo(practiceBackScreen())}>
            ← 返回上一级
          </button>
          <span className="eyebrow">SESSION COMPLETE</span>
          <h1>{correctCount} / {answeredIds.length}</h1>
          <p>本次累计答题用时 {formatTime(totalSeconds)}。当前题号和未提交选择均已保存。</p>
          <div>
            {activeSession.context === "wrong" ? (
              <button className="primary-button" type="button" onClick={() => openWrongDashboard(activeSession.module)}>
                返回错题评估
              </button>
            ) : (
              <button className="primary-button" type="button" onClick={() => goTo(practiceBackScreen())}>
                返回练习方式
              </button>
            )}
            <button className="text-button" type="button" onClick={goHome}>返回首页</button>
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
          <p>为秋招学生做的行测刷题站。图形推理、材料分析与文字推理均已开放，只练大厂笔试真正会遇到的题。</p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => goTo("categories")}>进入分类刷题 →</button>
            <button className="primary-button secondary-green" type="button" onClick={() => goTo("mock")}>进入模考 →</button>
            <button className="primary-button secondary-green" type="button" onClick={() => goTo("wrong-categories")}>错题集 →</button>
            <a href="#structure">看看题库结构</a>
          </div>
        </div>
        <aside className="hero-board" aria-label="题库概览">
          <div className="board-top"><span>北森题库 · 三大模块</span><em>持续更新</em></div>
          <div className="board-score">
            <div>
              <span>去重后已录入</span>
              <strong>{questions.length + materialQuestions.length + verbalQuestions.length}</strong>
              <small>图形 + 材料 + 文字</small>
            </div>
            <div className="mini-chart" aria-hidden="true">
              {[48, 67, 54, 82, 72, 92, 78].map((height) => (
                <i key={height} style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
          <div className="board-progress">
            <div><span>图形推理</span><strong>{questions.length} 题</strong></div>
            <div><span>材料分析</span><strong>{materialQuestions.length} 题</strong></div>
            <div><span>文字推理</span><strong>{verbalQuestions.length} 题</strong></div>
          </div>
          <div className="board-footer"><span>答案提交后显示</span><span>进度与错题即时保存</span></div>
        </aside>
      </section>

      <section className="structure-section" id="structure">
        <span className="eyebrow">QUESTION BANK</span><h2>题库结构</h2>
        <div className="structure-grid">
          <article><span>01</span><h3>图形推理</h3><p>随机或按考点练习 {questions.length} 道去重题，图片优先保留 PDF 原图。</p></article>
          <article><span>02</span><h3>材料分析</h3><p>按原题顺序练习 {materialQuestions.length} 道去重题，题干与图表分开呈现。</p></article>
          <article><span>03</span><h3>文字推理</h3><p>随机或按类型练习 {verbalQuestions.length} 道去重题，提交后显示细化考点。</p></article>
          <article><span>04</span><h3>错题集</h3><p>三大模块分别统计；错题即时加入，答对后自动移出。</p></article>
        </div>
      </section>
    </main>
  );
}
