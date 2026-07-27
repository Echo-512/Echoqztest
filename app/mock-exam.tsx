"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import materialQuestionData from "./material-questions.json";
import questionData from "./questions.json";
import { supabase } from "./supabase-client";
import verbalQuestionData from "./verbal-questions.json";

type Difficulty = "入门" | "提高" | "强化";
type ModuleKey = "graphic" | "material" | "verbal";

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
};

type VerbalQuestion = {
  sourceId: string;
  prompt: string;
  options: string[];
  answer: string;
  optionCount: number;
  category: string;
  point: string;
  difficulty: Difficulty;
  analysis: string;
  method: string;
};

type BankQuestion = GraphicQuestion | MaterialQuestion | VerbalQuestion;

type ActiveModule = {
  questionIds: string[];
  current: number;
  selected: Record<string, string>;
  answers: Record<string, string>;
  correct: Record<string, boolean>;
  questionTimes: Record<string, number>;
  currentSeconds: number;
  sectionElapsed: number;
  completed: boolean;
};

type ActiveExam = {
  id: string;
  startedAt: string;
  moduleOrder: ModuleKey[];
  activeModuleIndex: number;
  phase: "intro" | "question" | "between";
  modules: Record<ModuleKey, ActiveModule>;
};

type CompletedModule = {
  questionIds: string[];
  answers: Record<string, string>;
  correct: Record<string, boolean>;
  questionTimes: Record<string, number>;
  sectionElapsed: number;
};

type CompletedExam = {
  id: string;
  startedAt: string;
  completedAt: string;
  moduleOrder: ModuleKey[];
  modules: Record<ModuleKey, CompletedModule>;
};

type HistorySummary = {
  id: string;
  startedAt: string;
  completedAt: string;
  totalCorrect: number;
  totalQuestions: number;
  durationSeconds: number;
  questionIds: string[];
};

type MockView = "landing" | "preparing" | "intro" | "question" | "between" | "report";
type FavoriteState = Record<ModuleKey, string[]>;

type MockExamProps = {
  onHome: () => void;
  onPractice: () => void;
  onProfile: () => void;
  favorites: FavoriteState;
  onToggleFavorite: (module: ModuleKey, sourceId: string) => void;
  onComplete: (
    outcomes: Array<{ module: ModuleKey; sourceId: string; isCorrect: boolean }>,
  ) => void;
};

const graphicQuestions = questionData as GraphicQuestion[];
const materialQuestions = materialQuestionData as MaterialQuestion[];
const verbalQuestions = verbalQuestionData as VerbalQuestion[];
const graphicById = new Map(
  graphicQuestions.map((question) => [question.sourceId, question]),
);
const materialById = new Map(
  materialQuestions.map((question) => [question.sourceId, question]),
);
const verbalById = new Map(
  verbalQuestions.map((question) => [question.sourceId, question]),
);
const letters = ["A", "B", "C", "D", "E", "F"];
const moduleNames: Record<ModuleKey, string> = {
  graphic: "图形推理",
  material: "材料分析",
  verbal: "文字推理",
};
const activeExamStorageKey = "qiuzhao-xingce-active-mock-v1";
const activeExamUpdatedAtKey = "qiuzhao-xingce-active-mock-updated-v1";
const localHistoryStorageKey = "qiuzhao-xingce-mock-history-cache-v1";
const lastExamQuestionIdsKey = "qiuzhao-xingce-last-mock-questions-v1";
const questionSeconds = 70;

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(
    safe % 60,
  ).padStart(2, "0")}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function bankFor(module: ModuleKey): BankQuestion[] {
  if (module === "graphic") return graphicQuestions;
  if (module === "material") return materialQuestions;
  return verbalQuestions;
}

function questionFor(module: ModuleKey, sourceId: string) {
  if (module === "graphic") return graphicById.get(sourceId);
  if (module === "material") return materialById.get(sourceId);
  return verbalById.get(sourceId);
}

function questionPoints(module: ModuleKey, question: BankQuestion) {
  if (module === "graphic") {
    const graphic = question as GraphicQuestion;
    return [graphic.point, ...graphic.finePoints];
  }
  if (module === "verbal") {
    const verbal = question as VerbalQuestion;
    return [verbal.category, verbal.point];
  }
  return ["材料分析综合题"];
}

function imageAssets(module: ModuleKey, question: BankQuestion) {
  if (module === "graphic") {
    const graphic = question as GraphicQuestion;
    return [graphic.image, ...graphic.optionImages];
  }
  if (module === "material" && (question as MaterialQuestion).image) {
    return [(question as MaterialQuestion).image as string];
  }
  return [];
}

function preloadImage(url: string) {
  return new Promise<void>((resolve) => {
    const image = new window.Image();
    const finish = () => {
      if (typeof image.decode === "function") {
        image.decode().catch(() => undefined).finally(resolve);
      } else {
        resolve();
      }
    };
    image.onload = finish;
    image.onerror = () => resolve();
    image.src = url;
  });
}

async function waitForVisibleQuestion(urls: string[]) {
  await Promise.all(urls.map(preloadImage));
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  });
}

function categoryForSelection(module: ModuleKey, question: BankQuestion) {
  if (module === "graphic") return (question as GraphicQuestion).point;
  if (module === "verbal") return (question as VerbalQuestion).category;
  return question.difficulty;
}

function pickDiverseQuestions(
  module: ModuleKey,
  excluded: Set<string>,
  simpleEleven: boolean,
) {
  const target = simpleEleven ? 11 : 10;
  const desired: Record<Difficulty, number> = simpleEleven
    ? { 入门: 6, 提高: 4, 强化: 1 }
    : { 入门: 2, 提高: 6, 强化: 2 };
  const wholeBank = bankFor(module);
  const withoutPrevious = wholeBank.filter((question) => !excluded.has(question.sourceId));
  const pool = withoutPrevious.length >= target ? withoutPrevious : wholeBank;
  const chosen: BankQuestion[] = [];
  const chosenIds = new Set<string>();
  const categoryCounts = new Map<string, number>();

  const chooseOne = (candidates: BankQuestion[]) => {
    const available = shuffle(
      candidates.filter((question) => !chosenIds.has(question.sourceId)),
    );
    if (!available.length) return false;
    const lowestCount = Math.min(
      ...available.map(
        (question) => categoryCounts.get(categoryForSelection(module, question)) ?? 0,
      ),
    );
    const balanced = available.filter(
      (question) =>
        (categoryCounts.get(categoryForSelection(module, question)) ?? 0) ===
        lowestCount,
    );
    const picked = balanced[Math.floor(Math.random() * balanced.length)];
    chosen.push(picked);
    chosenIds.add(picked.sourceId);
    const category = categoryForSelection(module, picked);
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    return true;
  };

  for (const difficulty of ["强化", "提高", "入门"] as Difficulty[]) {
    const candidates = pool.filter((question) => question.difficulty === difficulty);
    for (let count = 0; count < desired[difficulty]; count += 1) {
      if (!chooseOne(candidates)) break;
    }
  }
  while (chosen.length < target && chooseOne(pool)) {
    // Fill a rare missing difficulty quota while keeping categories balanced.
  }
  return shuffle(chosen).slice(0, target);
}

function emptyModule(questions: BankQuestion[]): ActiveModule {
  return {
    questionIds: questions.map((question) => question.sourceId),
    current: 0,
    selected: {},
    answers: {},
    correct: {},
    questionTimes: {},
    currentSeconds: 0,
    sectionElapsed: 0,
    completed: false,
  };
}

function createExam(excluded: Set<string>): ActiveExam {
  const moduleOrder = shuffle<ModuleKey>(["graphic", "material", "verbal"]);
  const simpleModule =
    Math.random() < 0.12
      ? moduleOrder[Math.floor(Math.random() * moduleOrder.length)]
      : null;
  const modules = {
    graphic: emptyModule(
      pickDiverseQuestions("graphic", excluded, simpleModule === "graphic"),
    ),
    material: emptyModule(
      pickDiverseQuestions("material", excluded, simpleModule === "material"),
    ),
    verbal: emptyModule(
      pickDiverseQuestions("verbal", excluded, simpleModule === "verbal"),
    ),
  };
  return {
    id:
      typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `mock-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    startedAt: new Date().toISOString(),
    moduleOrder,
    activeModuleIndex: 0,
    phase: "intro",
    modules,
  };
}

function allQuestionIds(exam: Pick<ActiveExam, "modules"> | CompletedExam) {
  return (["graphic", "material", "verbal"] as ModuleKey[]).flatMap(
    (module) => exam.modules[module].questionIds,
  );
}

function summaryFromRecord(record: CompletedExam): HistorySummary {
  const modules = Object.values(record.modules);
  const totalQuestions = modules.reduce(
    (sum, module) => sum + module.questionIds.length,
    0,
  );
  const totalCorrect = modules.reduce(
    (sum, module) =>
      sum + module.questionIds.filter((id) => module.correct[id]).length,
    0,
  );
  return {
    id: record.id,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    totalCorrect,
    totalQuestions,
    durationSeconds: modules.reduce(
      (sum, module) => sum + module.sectionElapsed,
      0,
    ),
    questionIds: allQuestionIds(record),
  };
}

function validActiveExam(value: unknown): value is ActiveExam {
  if (!value || typeof value !== "object") return false;
  const exam = value as ActiveExam;
  if (
    !exam.id ||
    !Array.isArray(exam.moduleOrder) ||
    exam.moduleOrder.length !== 3 ||
    !exam.modules
  ) {
    return false;
  }
  return exam.moduleOrder.every((module) =>
    exam.modules[module]?.questionIds?.every((id) => Boolean(questionFor(module, id))),
  );
}

function QuestionBody({
  module,
  question,
  choice,
  reveal,
  disabled,
  onChoose,
}: {
  module: ModuleKey;
  question: BankQuestion;
  choice?: string;
  reveal?: boolean;
  disabled?: boolean;
  onChoose?: (letter: string) => void;
}) {
  const stateClass = (letter: string) => {
    if (!reveal) return choice === letter ? "selected-choice" : "";
    if (letter === question.answer) return "correct-choice";
    return choice === letter ? "wrong-choice" : "";
  };

  if (module === "graphic") {
    const graphic = question as GraphicQuestion;
    return (
      <>
        <div className={`source-image-wrap ${graphic.optionImages.length ? "stem-image-wrap" : ""}`}>
          <img src={graphic.image} alt={`${graphic.sourceId} 图形推理题`} draggable={false} />
        </div>
        {graphic.optionImages.length === graphic.optionCount ? (
          <div className="source-options" aria-label="答案选项">
            {graphic.optionImages.map((image, index) => {
              const letter = letters[index];
              return (
                <button
                  key={image}
                  type="button"
                  className={`source-option-button ${stateClass(letter)}`}
                  onClick={() => onChoose?.(letter)}
                  disabled={disabled}
                >
                  <span>{letter}</span>
                  <img src={image} alt={`选项 ${letter}`} draggable={false} />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="answer-zone">
            <p>选择你的答案</p>
            <div className="answer-buttons">
              {letters.slice(0, graphic.optionCount).map((letter) => (
                <button
                  key={letter}
                  type="button"
                  className={stateClass(letter)}
                  onClick={() => onChoose?.(letter)}
                  disabled={disabled}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        )}
      </>
    );
  }

  const textQuestion = question as MaterialQuestion | VerbalQuestion;
  return (
    <>
      <p className={module === "material" ? "material-prompt" : "verbal-prompt"}>
        {textQuestion.prompt}
      </p>
      {module === "material" && (question as MaterialQuestion).image && (
        <div className="source-image-wrap material-chart-wrap">
          <img
            src={(question as MaterialQuestion).image as string}
            alt={`${question.sourceId} 原 PDF 图表`}
            draggable={false}
          />
        </div>
      )}
      <div className="material-options" aria-label="答案选项">
        {textQuestion.options.map((option, index) => {
          const letter = letters[index];
          return (
            <button
              key={`${question.sourceId}-${letter}`}
              type="button"
              className={`material-option-button ${stateClass(letter)}`}
              onClick={() => onChoose?.(letter)}
              disabled={disabled}
            >
              <strong>{letter}</strong><span>{option}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function MockNav({
  onHome,
  onPractice,
}: {
  onHome: () => void;
  onPractice: () => void;
}) {
  return (
    <nav className="site-nav" aria-label="主导航">
      <button className="logo" type="button" onClick={onHome}>
        <span className="logo-mark">Q</span>
        秋招行测
        <em>beta</em>
      </button>
      <div className="nav-links">
        <button type="button" onClick={onHome}>首页</button>
        <span>北森题库 · 三模块模拟考试</span>
      </div>
      <button className="nav-cta" type="button" onClick={onPractice}>分类刷题</button>
    </nav>
  );
}

function MockBottomNav({
  onHome,
  onPractice,
  onProfile,
}: {
  onHome: () => void;
  onPractice: () => void;
  onProfile: () => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="底部导航">
      <button type="button" onClick={onHome}><span>⌂</span><small>首页</small></button>
      <button type="button" onClick={onPractice}><span>▣</span><small>题库</small></button>
      <button className="active" type="button"><span>◷</span><small>模考</small></button>
      <button type="button" onClick={onProfile}><span>☺</span><small>我的</small></button>
    </nav>
  );
}

export default function MockExam({
  onHome,
  onPractice,
  onProfile,
  favorites,
  onToggleFavorite,
  onComplete,
}: MockExamProps) {
  const [view, setView] = useState<MockView>("landing");
  const [exam, setExam] = useState<ActiveExam | null>(null);
  const [resumableExam, setResumableExam] = useState<ActiveExam | null>(null);
  const [questionReady, setQuestionReady] = useState(false);
  const [report, setReport] = useState<CompletedExam | null>(null);
  const [history, setHistory] = useState<HistorySummary[]>([]);
  const [localRecords, setLocalRecords] = useState<CompletedExam[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [draftSyncReady, setDraftSyncReady] = useState(false);
  const mockTimerEnabledRef = useRef(false);
  const autoFinishRef = useRef<() => void>(() => undefined);
  const examRef = useRef<ActiveExam | null>(null);
  const lastDraftUpdatedAtRef = useRef("");

  const activeModuleKey = exam?.moduleOrder[exam.activeModuleIndex];
  const activeModule = activeModuleKey ? exam?.modules[activeModuleKey] : undefined;
  const activeQuestionSeconds = activeModule?.currentSeconds;
  const activeQuestionId =
    activeModule?.questionIds[activeModule.current] ?? "";
  const activeQuestion =
    activeModuleKey && activeQuestionId
      ? questionFor(activeModuleKey, activeQuestionId)
      : undefined;

  useEffect(() => {
    let cachedRecords: CompletedExam[] = [];
    let localDraft: ActiveExam | null = null;
    try {
      const cached = window.localStorage.getItem(localHistoryStorageKey);
      if (cached) cachedRecords = JSON.parse(cached) as CompletedExam[];
      const active = window.localStorage.getItem(activeExamStorageKey);
      if (active) {
        const parsed = JSON.parse(active) as unknown;
        if (validActiveExam(parsed)) {
          localDraft = parsed;
          window.setTimeout(() => setResumableExam(parsed), 0);
        }
      }
    } catch {
      window.localStorage.removeItem(activeExamStorageKey);
    }
    const localSummaries = cachedRecords.map(summaryFromRecord);
    window.setTimeout(() => {
      setLocalRecords(cachedRecords);
      setHistory(localSummaries);
    }, 0);

    fetch("/api/exams")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: { records?: HistorySummary[] }) => {
        const merged = new Map<string, HistorySummary>();
        for (const item of payload.records ?? []) merged.set(item.id, item);
        for (const item of localSummaries) {
          if (!merged.has(item.id)) merged.set(item.id, item);
        }
        setHistory(
          [...merged.values()].sort((left, right) =>
            right.completedAt.localeCompare(left.completedAt),
          ),
        );
      })
      .catch(() => undefined)
      .finally(() => setHistoryLoading(false));

    const localDraftUpdatedAt =
      window.localStorage.getItem(activeExamUpdatedAtKey) ?? "";
    lastDraftUpdatedAtRef.current = localDraftUpdatedAt;
    fetch("/api/exams/draft", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: { draft?: unknown; updatedAt?: string | null }) => {
        if (
          payload.updatedAt &&
          payload.updatedAt >= localDraftUpdatedAt &&
          validActiveExam(payload.draft)
        ) {
          setResumableExam(payload.draft);
          window.localStorage.setItem(
            activeExamStorageKey,
            JSON.stringify(payload.draft),
          );
          window.localStorage.setItem(activeExamUpdatedAtKey, payload.updatedAt);
          lastDraftUpdatedAtRef.current = payload.updatedAt;
        } else if (localDraft) {
          setResumableExam(localDraft);
        }
      })
      .catch(() => undefined)
      .finally(() => setDraftSyncReady(true));
  }, []);

  useEffect(() => {
    if (!exam) return;
    examRef.current = exam;
    window.localStorage.setItem(activeExamStorageKey, JSON.stringify(exam));
  }, [exam]);

  useEffect(() => {
    const draft = examRef.current;
    if (!draft || !draftSyncReady) return;
    const updatedAt = new Date().toISOString();
    window.localStorage.setItem(activeExamUpdatedAtKey, updatedAt);
    const timer = window.setTimeout(() => {
      fetch("/api/exams/draft", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draft }),
        keepalive: true,
      })
        .then((response) => (response.ok ? response.json() : Promise.reject()))
        .then((payload: { updatedAt?: string }) => {
          if (!payload.updatedAt) return;
          lastDraftUpdatedAtRef.current = payload.updatedAt;
          window.localStorage.setItem(activeExamUpdatedAtKey, payload.updatedAt);
        })
        .catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [
    draftSyncReady,
    exam?.id,
    exam?.phase,
    exam?.activeModuleIndex,
    activeModuleKey,
    activeQuestionId,
    activeModule?.selected,
    activeModule?.answers,
    activeModule?.questionTimes,
  ]);

  useEffect(() => {
    if (!draftSyncReady) return;
    const timer = window.setInterval(() => {
      const draft = examRef.current;
      if (!draft) return;
      fetch("/api/exams/draft", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draft }),
        keepalive: true,
      }).catch(() => undefined);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [draftSyncReady]);

  useEffect(() => {
    if (view !== "question" || !activeModuleKey || !activeQuestion) {
      mockTimerEnabledRef.current = false;
      return;
    }
    let cancelled = false;
    mockTimerEnabledRef.current = false;
    waitForVisibleQuestion(imageAssets(activeModuleKey, activeQuestion)).then(() => {
      if (!cancelled) {
        mockTimerEnabledRef.current = true;
        setQuestionReady(true);
      }
    });
    return () => {
      cancelled = true;
      mockTimerEnabledRef.current = false;
    };
  }, [view, activeModuleKey, activeQuestionId, activeQuestion]);

  useEffect(() => {
    if (
      view !== "question" ||
      !questionReady ||
      !activeModuleKey
    ) {
      return;
    }
    const startedAt = Date.now();
    let appliedSeconds = 0;
    const timer = window.setInterval(() => {
      if (!mockTimerEnabledRef.current) return;
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      const delta = elapsedSeconds - appliedSeconds;
      if (delta <= 0) return;
      appliedSeconds = elapsedSeconds;
      setExam((currentExam) => {
        if (!currentExam || currentExam.phase !== "question") return currentExam;
        const moduleKey = currentExam.moduleOrder[currentExam.activeModuleIndex];
        const current = currentExam.modules[moduleKey];
        if (current.currentSeconds >= questionSeconds) return currentExam;
        const appliedDelta = Math.min(delta, questionSeconds - current.currentSeconds);
        return {
          ...currentExam,
          modules: {
            ...currentExam.modules,
            [moduleKey]: {
              ...current,
              currentSeconds: current.currentSeconds + appliedDelta,
            },
          },
        };
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, [view, questionReady, activeModuleKey, activeQuestionId]);

  async function prepareExam(nextExam: ActiveExam) {
    setView("preparing");
    mockTimerEnabledRef.current = false;
    setQuestionReady(false);
    setExam(nextExam);
    const urls = nextExam.moduleOrder.flatMap((moduleKey) =>
      nextExam.modules[moduleKey].questionIds.flatMap((id) => {
        const question = questionFor(moduleKey, id);
        return question ? imageAssets(moduleKey, question) : [];
      }),
    );
    await Promise.all([...new Set(urls)].map(preloadImage));
    setView(nextExam.phase);
  }

  function startNewExam() {
    const previousIds = new Set<string>();
    const latest = history[0];
    if (latest) {
      for (const id of latest.questionIds) previousIds.add(id);
    } else {
      try {
        const saved = window.localStorage.getItem(lastExamQuestionIdsKey);
        for (const id of saved ? (JSON.parse(saved) as string[]) : []) {
          previousIds.add(id);
        }
      } catch {
        window.localStorage.removeItem(lastExamQuestionIdsKey);
      }
    }
    const nextExam = createExam(previousIds);
    window.localStorage.setItem(
      lastExamQuestionIdsKey,
      JSON.stringify(allQuestionIds(nextExam)),
    );
    void prepareExam(nextExam);
  }

  function resumeExam() {
    if (resumableExam) void prepareExam(resumableExam);
  }

  function beginCurrentModule() {
    if (!exam) return;
    mockTimerEnabledRef.current = false;
    setExam({ ...exam, phase: "question" });
    setView("question");
  }

  function selectAnswer(letter: string) {
    if (!exam || !activeModuleKey || !activeQuestionId) return;
    const moduleState = exam.modules[activeModuleKey];
    setExam({
      ...exam,
      modules: {
        ...exam.modules,
        [activeModuleKey]: {
          ...moduleState,
          selected: { ...moduleState.selected, [activeQuestionId]: letter },
        },
      },
    });
  }

  function finalizeCompletedExam(active: ActiveExam) {
    const completedAt = new Date().toISOString();
    const completedModules = Object.fromEntries(
      (["graphic", "material", "verbal"] as ModuleKey[]).map((moduleKey) => {
        const state = active.modules[moduleKey];
        const correct = { ...state.correct };
        for (const id of state.questionIds) {
          const question = questionFor(moduleKey, id);
          correct[id] = Boolean(
            question && state.answers[id] && state.answers[id] === question.answer,
          );
        }
        return [
          moduleKey,
          {
            questionIds: state.questionIds,
            answers: state.answers,
            correct,
            questionTimes: state.questionTimes,
            sectionElapsed: state.sectionElapsed,
          },
        ];
      }),
    ) as Record<ModuleKey, CompletedModule>;
    const record: CompletedExam = {
      id: active.id,
      startedAt: active.startedAt,
      completedAt,
      moduleOrder: active.moduleOrder,
      modules: completedModules,
    };

    const outcomes = record.moduleOrder.flatMap((moduleKey) =>
      record.modules[moduleKey].questionIds.map((sourceId) => ({
        module: moduleKey,
        sourceId,
        isCorrect: record.modules[moduleKey].correct[sourceId],
      })),
    );
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const summary = summaryFromRecord(record);
      const { error } = await supabase.from("exam_records").insert({
        user_id: user.id,
        score: summary.totalCorrect,
        total_questions: summary.totalQuestions,
        correct_count: summary.totalCorrect,
        time_used: summary.durationSeconds,
        details: record,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error("模考记录同步失败", error);
      }
    })();

    onComplete(outcomes);
    const nextLocal = [
      record,
      ...localRecords.filter((item) => item.id !== record.id),
    ].slice(0, 30);
    setLocalRecords(nextLocal);
    window.localStorage.setItem(localHistoryStorageKey, JSON.stringify(nextLocal));
    window.localStorage.removeItem(activeExamStorageKey);
    window.localStorage.removeItem(activeExamUpdatedAtKey);
    examRef.current = null;
    setResumableExam(null);
    setExam(null);
    setReport(record);
    setView("report");
    setHistory((current) => [
      summaryFromRecord(record),
      ...current.filter((item) => item.id !== record.id),
    ]);
    fetch("/api/exams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(record),
    }).catch(() => undefined);
    fetch("/api/exams/draft", {
      method: "DELETE",
      keepalive: true,
    }).catch(() => undefined);
  }

  function completeModule(snapshot: ActiveExam, moduleState: ActiveModule) {
    const moduleKey = snapshot.moduleOrder[snapshot.activeModuleIndex];
    const finishedState: ActiveModule = {
      ...moduleState,
      completed: true,
    };
    const updated: ActiveExam = {
      ...snapshot,
      phase: "between",
      modules: { ...snapshot.modules, [moduleKey]: finishedState },
    };
    if (snapshot.activeModuleIndex === snapshot.moduleOrder.length - 1) {
      finalizeCompletedExam(updated);
      return;
    }
    setExam(updated);
    setView("between");
  }

  function submitMockAnswer(timedOut = false) {
    if (!exam || !activeModuleKey || !activeQuestion || !activeQuestionId) return;
    const moduleState = exam.modules[activeModuleKey];
    const choice = moduleState.selected[activeQuestionId];
    if (!choice && !timedOut) return;
    mockTimerEnabledRef.current = false;
    setQuestionReady(false);
    const updatedModule: ActiveModule = {
      ...moduleState,
      answers: choice
        ? { ...moduleState.answers, [activeQuestionId]: choice }
        : moduleState.answers,
      correct: {
        ...moduleState.correct,
        [activeQuestionId]: Boolean(choice && choice === activeQuestion.answer),
      },
      questionTimes: {
        ...moduleState.questionTimes,
        [activeQuestionId]: moduleState.currentSeconds,
      },
      sectionElapsed: moduleState.sectionElapsed + moduleState.currentSeconds,
    };
    if (moduleState.current >= moduleState.questionIds.length - 1) {
      completeModule(exam, updatedModule);
      return;
    }
    setExam({
      ...exam,
      modules: {
        ...exam.modules,
        [activeModuleKey]: {
          ...updatedModule,
          current: moduleState.current + 1,
          currentSeconds: 0,
        },
      },
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    autoFinishRef.current = () => submitMockAnswer(true);
  });

  useEffect(() => {
    if (
      view === "question" &&
      questionReady &&
      activeQuestionSeconds !== undefined &&
      activeQuestionSeconds >= questionSeconds
    ) {
      const timer = window.setTimeout(() => autoFinishRef.current(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [view, questionReady, activeQuestionSeconds]);

  function enterNextModule() {
    if (!exam) return;
    const updated: ActiveExam = {
      ...exam,
      activeModuleIndex: exam.activeModuleIndex + 1,
      phase: "intro",
    };
    setExam(updated);
    setView("intro");
  }

  async function openHistory(id: string) {
    const cached = localRecords.find((record) => record.id === id);
    if (cached) {
      setReport(cached);
      setView("report");
      return;
    }
    try {
      const response = await fetch(`/api/exams?id=${encodeURIComponent(id)}`);
      if (!response.ok) return;
      const payload = (await response.json()) as { record?: CompletedExam };
      if (payload.record) {
        setReport(payload.record);
        setView("report");
      }
    } catch {
      // The history list remains usable even if a cloud detail is temporarily unavailable.
    }
  }

  const reportStats = useMemo(() => {
    if (!report) return [];
    return report.moduleOrder.map((moduleKey) => {
      const state = report.modules[moduleKey];
      const correct = state.questionIds.filter((id) => state.correct[id]).length;
      return {
        module: moduleKey,
        correct,
        total: state.questionIds.length,
        seconds: state.sectionElapsed,
      };
    });
  }, [report]);

  const lossPoints = useMemo(() => {
    if (!report) return [];
    const counts = new Map<string, number>();
    for (const moduleKey of report.moduleOrder) {
      const state = report.modules[moduleKey];
      for (const id of state.questionIds) {
        if (state.correct[id]) continue;
        const question = questionFor(moduleKey, id);
        if (!question) continue;
        for (const point of questionPoints(moduleKey, question)) {
          counts.set(point, (counts.get(point) ?? 0) + 1);
        }
      }
    }
    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8);
  }, [report]);

  if (view === "landing") {
    return (
      <main className="inner-page mock-page has-bottom-nav">
        <MockNav onHome={onHome} onPractice={onPractice} />
        <section className="page-heading mock-heading">
          <button className="back-link" type="button" onClick={onHome}>← 返回首页</button>
          <span className="eyebrow">FULL MOCK EXAM</span>
          <h1>三模块真实模考</h1>
          <p>
            三个模块随机排序，通常每模块 10 题、每题限时 70 秒。不可跳题、
            不可回看，完成全部模块后统一显示成绩与解析。
          </p>
          <div className="mock-heading-actions">
            <button
              className="primary-button"
              type="button"
              onClick={startNewExam}
              disabled={historyLoading}
            >
              {historyLoading ? "正在同步上次模考…" : "生成一套新模考 →"}
            </button>
            {resumableExam && (
              <button className="resume-mode" type="button" onClick={resumeExam}>
                继续未完成模考
              </button>
            )}
          </div>
        </section>
        <section className="mock-rules">
          <article><span>01</span><h2>整套预生成</h2><p>先生成全部题目并预载图片，题目真正可见后才开始计时。</p></article>
          <article><span>02</span><h2>连续作答</h2><p>顶部圆点只显示进度，不能点击跳题；提交后直接进入下一题。</p></article>
          <article><span>03</span><h2>统一结算</h2><p>三个模块做完后再显示正确率、失分考点与全部题目回看。</p></article>
        </section>
        <section className="mock-history">
          <div className="mock-section-title">
            <div><span className="eyebrow">EXAM HISTORY</span><h2>过往模考记录</h2></div>
            <small>{historyLoading ? "正在同步…" : `共 ${history.length} 场`}</small>
          </div>
          {history.length ? (
            <div className="mock-history-list">
              {history.map((item, index) => (
                <button key={item.id} type="button" onClick={() => void openHistory(item.id)}>
                  <span>第 {history.length - index} 场</span>
                  <strong>{item.totalCorrect}/{item.totalQuestions}</strong>
                  <em>{Math.round((item.totalCorrect / item.totalQuestions) * 100)}%</em>
                  <small>{formatDate(item.completedAt)} · {formatTime(item.durationSeconds)}</small>
                  <b>回看 →</b>
                </button>
              ))}
            </div>
          ) : (
            <div className="mock-history-empty">完成第一场模考后，这里会保存成绩和全部题目。</div>
          )}
        </section>
        <MockBottomNav onHome={onHome} onPractice={onPractice} onProfile={onProfile} />
      </main>
    );
  }

  if (view === "preparing") {
    return (
      <main className="mock-preparing">
        <div className="mock-loader" aria-hidden="true"><i /><i /><i /></div>
        <span className="eyebrow">PREPARING YOUR PAPER</span>
        <h1>正在生成整套试卷</h1>
        <p>题目、选项与图片全部准备好后才会进入考试，当前不计时。</p>
      </main>
    );
  }

  if ((view === "intro" || view === "between") && exam && activeModuleKey) {
    const completedCount = exam.moduleOrder.filter(
      (module) => exam.modules[module].completed,
    ).length;
    return (
      <main className="inner-page mock-stage-page">
        <MockNav onHome={onHome} onPractice={onPractice} />
        <section className="mock-stage-card">
          <span className="eyebrow">
            {view === "between" ? "SECTION COMPLETE" : `SECTION ${exam.activeModuleIndex + 1}`}
          </span>
          {view === "between" ? (
            <>
              <h1>{moduleNames[activeModuleKey]}已完成</h1>
              <p>本模块暂不显示成绩。下一模块的题目已经准备好，计时仍未开始。</p>
              <button className="primary-button" type="button" onClick={enterNextModule}>
                进入下一模块 →
              </button>
            </>
          ) : (
            <>
              <h1>{moduleNames[activeModuleKey]}</h1>
              <p>
                本模块 {activeModule?.questionIds.length} 题，每题独立限时 70 秒。
                倒计时结束会自动保存当前选择并进入下一题，完成后不能返回修改。
              </p>
              <button className="primary-button" type="button" onClick={beginCurrentModule}>
                开始本模块 →
              </button>
            </>
          )}
          <div className="mock-order" aria-label="本场模考模块顺序">
            {exam.moduleOrder.map((module, index) => (
              <div
                key={module}
                className={
                  index < completedCount
                    ? "completed"
                    : index === exam.activeModuleIndex
                      ? "current"
                      : ""
                }
              >
                <span>{index + 1}</span>
                <strong>{moduleNames[module]}</strong>
                <small>{exam.modules[module].questionIds.length} 题</small>
              </div>
            ))}
          </div>
        </section>
      </main>
    );
  }

  if (
    view === "question" &&
    exam &&
    activeModuleKey &&
    activeModule &&
    activeQuestion
  ) {
    const choice = activeModule.selected[activeQuestionId];
    const isFavorite = favorites[activeModuleKey].includes(activeQuestionId);
    return (
      <main className="practice-shell mock-exam-shell">
        <header className="mock-exam-header">
          <div className="mock-module-name">
            <small>模块 {exam.activeModuleIndex + 1}/3</small>
            <strong>{moduleNames[activeModuleKey]}</strong>
          </div>
          <div className="mock-question-position">
            <small>当前进度</small>
            <strong>{activeModule.current + 1}/{activeModule.questionIds.length}</strong>
          </div>
          <div className="mock-question-timer">
            <small>{questionReady ? "本题剩余" : "题目准备中"}</small>
            <strong>
              {formatTime(Math.max(0, questionSeconds - activeModule.currentSeconds))}
            </strong>
          </div>
        </header>
        <section className="mock-question-strip" aria-label="题目进度">
          {activeModule.questionIds.map((id, index) => (
            <span
              key={id}
              className={
                index < activeModule.current
                  ? "completed"
                  : index === activeModule.current
                    ? "current"
                    : ""
              }
            >
              {index + 1}
            </span>
          ))}
        </section>
        <section className="practice-content mock-question-content">
          <div className="question-meta">
            <span>第 {activeModule.current + 1} 题</span>
            <span>{activeQuestion.difficulty}</span>
            <em>
              {questionReady ? "计时中 · 提交后不可返回" : "题目完整显示后开始计时"}
            </em>
            <button
              className={`favorite-toggle ${isFavorite ? "is-favorite" : ""}`}
              type="button"
              aria-label={isFavorite ? "取消收藏本题" : "收藏本题"}
              title={isFavorite ? "取消收藏本题" : "收藏本题"}
              onClick={() => onToggleFavorite(activeModuleKey, activeQuestionId)}
            >
              {isFavorite ? "★" : "☆"}
            </button>
          </div>
          <div className={`timed-question-frame ${questionReady ? "" : "is-loading"}`}>
          <article
            key={activeQuestionId}
            className={`question-card ${activeModuleKey === "material" ? "material-question-card" : ""} ${activeModuleKey === "verbal" ? "verbal-question-card" : ""}`}
          >
            <QuestionBody
              module={activeModuleKey}
              question={activeQuestion}
              choice={choice}
              disabled={!questionReady}
              onChoose={selectAnswer}
            />
          </article>
          {!questionReady && (
            <div className="question-loading-mask" role="status">
              <div className="mock-loader" aria-hidden="true"><i /><i /><i /></div>
              <strong>正在载入第 {activeModule.current + 1} 题</strong>
              <span>旧题已停止计时，新题完整显示后自动开始</span>
            </div>
          )}
          </div>
          <button
            className="submit-button"
            type="button"
            onClick={() => submitMockAnswer(false)}
            disabled={!choice || !questionReady}
          >
            {activeModule.current === activeModule.questionIds.length - 1
              ? "提交本模块"
              : "确认并进入下一题 →"}
          </button>
        </section>
      </main>
    );
  }

  if (view === "report" && report) {
    const totalCorrect = reportStats.reduce((sum, item) => sum + item.correct, 0);
    const totalQuestions = reportStats.reduce((sum, item) => sum + item.total, 0);
    const totalSeconds = reportStats.reduce((sum, item) => sum + item.seconds, 0);
    return (
      <main className="inner-page mock-report-page has-bottom-nav">
        <MockNav onHome={onHome} onPractice={onPractice} />
        <section className="mock-report-hero">
          <button className="back-link" type="button" onClick={() => setView("landing")}>
            ← 返回模考记录
          </button>
          <span className="eyebrow">FULL EXAM REPORT</span>
          <h1>{totalCorrect}<small> / {totalQuestions}</small></h1>
          <p>
            整场正确率 {Math.round((totalCorrect / totalQuestions) * 100)}%，
            实际作答用时 {formatTime(totalSeconds)}。本场错题已同步加入错题集。
          </p>
        </section>
        <section className="mock-score-grid">
          {reportStats.map((item) => (
            <article key={item.module}>
              <span>{moduleNames[item.module]}</span>
              <strong>{item.correct}/{item.total}</strong>
              <em>{Math.round((item.correct / item.total) * 100)}%</em>
              <small>用时 {formatTime(item.seconds)}</small>
            </article>
          ))}
        </section>
        <section className="mock-loss-card">
          <div><span className="eyebrow">LOSS ANALYSIS</span><h2>主要失分点</h2></div>
          {lossPoints.length ? (
            <div className="weak-tags">
              {lossPoints.map(([point, count]) => (
                <span key={point}>{point}<em>{count}</em></span>
              ))}
            </div>
          ) : (
            <p>本场没有错题，三个模块全部答对。</p>
          )}
        </section>
        <section className="mock-review">
          <div className="mock-section-title">
            <div><span className="eyebrow">QUESTION REVIEW</span><h2>全部题目回看</h2></div>
            <small>错题已默认展开</small>
          </div>
          {report.moduleOrder.map((moduleKey) => (
            <div className="mock-review-module" key={moduleKey}>
              <h3>{moduleNames[moduleKey]}</h3>
              {report.modules[moduleKey].questionIds.map((id, index) => {
                const question = questionFor(moduleKey, id);
                if (!question) return null;
                const chosen = report.modules[moduleKey].answers[id];
                const correct = report.modules[moduleKey].correct[id];
                return (
                  <details key={`${report.id}-${moduleKey}-${id}`} open={!correct}>
                    <summary>
                      <span>第 {index + 1} 题</span>
                      <strong className={correct ? "review-correct" : "review-wrong"}>
                        {correct ? "正确" : "错误"}
                      </strong>
                      <em>你的答案 {chosen ?? "未作答"} · 正确答案 {question.answer}</em>
                      <small>{formatTime(report.modules[moduleKey].questionTimes[id] ?? 0)}</small>
                    </summary>
                    <article
                      className={`question-card ${moduleKey === "material" ? "material-question-card" : ""} ${moduleKey === "verbal" ? "verbal-question-card" : ""}`}
                    >
                      <QuestionBody
                        module={moduleKey}
                        question={question}
                        choice={chosen}
                        reveal
                        disabled
                      />
                    </article>
                    <div className="mock-review-analysis">
                      <h4>解析</h4>
                      {question.analysis
                        .split("\n")
                        .filter(Boolean)
                        .map((paragraph, paragraphIndex) => (
                          <p key={`${id}-review-${paragraphIndex}`}>{paragraph}</p>
                        ))}
                      <div className="concept-tags">
                        {questionPoints(moduleKey, question).map((point) => (
                          <span key={`${id}-${point}`}>{point}</span>
                        ))}
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          ))}
        </section>
        <MockBottomNav onHome={onHome} onPractice={onPractice} onProfile={onProfile} />
      </main>
    );
  }

  return null;
}
