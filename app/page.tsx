"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import materialQuestionData from "./material-questions.json";
import MockExam from "./mock-exam";
import questionData from "./questions.json";
import verbalQuestionData from "./verbal-questions.json";

type Difficulty = "入门" | "提高" | "强化";
type ModuleKey = "graphic" | "material" | "verbal";
type PracticeContext = "normal" | "wrong" | "favorite";
type Screen =
  | "home"
  | "categories"
  | "graphic-mode"
  | "verbal-mode"
  | "mock"
  | "practice"
  | "result"
  | "wrong-categories"
  | "wrong-dashboard"
  | "favorite-categories"
  | "profile";

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
type FavoriteState = Record<ModuleKey, string[]>;

type CloudPracticePayload = {
  sessions: Record<string, SavedSession>;
  performance: PerformanceState;
  favorites: FavoriteState;
};

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
  "graphic-favorite": "qiuzhao-xingce-graphic-favorite-session-v1",
  "material-normal": "qiuzhao-xingce-material-session-v1",
  "material-wrong": "qiuzhao-xingce-material-wrong-session-v1",
  "material-favorite": "qiuzhao-xingce-material-favorite-session-v1",
  "verbal-normal": "qiuzhao-xingce-verbal-session-v1",
  "verbal-wrong": "qiuzhao-xingce-verbal-wrong-session-v1",
  "verbal-favorite": "qiuzhao-xingce-verbal-favorite-session-v1",
};
const performanceStorageKey = "qiuzhao-xingce-performance-v1";
const favoritesStorageKey = "qiuzhao-xingce-favorites-v1";
const cloudProgressUpdatedAtKey = "qiuzhao-xingce-cloud-progress-updated-v1";
const preloadAheadCount = 10;
const practiceImageCache = new Map<string, Promise<void>>();
const initialPerformance: PerformanceState = {
  graphic: { attempts: 0, correct: 0, wrongIds: [] },
  material: { attempts: 0, correct: 0, wrongIds: [] },
  verbal: { attempts: 0, correct: 0, wrongIds: [] },
};
const initialFavorites: FavoriteState = {
  graphic: [],
  material: [],
  verbal: [],
};
const moduleNames: Record<ModuleKey, string> = {
  graphic: "图形推理",
  material: "材料分析",
  verbal: "文字推理",
};
const moduleIcons: Record<ModuleKey, string> = {
  graphic: "🧩",
  material: "📊",
  verbal: "💬",
};
const pieColors = ["#3d4a5c", "#d4685c", "#7f93aa", "#a9bacb", "#cbd6e0", "#8ca2b6"];

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

function practiceImageAssets(module: ModuleKey, question: BankQuestion) {
  if (module === "graphic") {
    const graphic = question as GraphicQuestion;
    return [graphic.image, ...graphic.optionImages];
  }
  if (module === "material" && (question as MaterialQuestion).image) {
    return [(question as MaterialQuestion).image as string];
  }
  return [];
}

function preloadPracticeImage(url: string) {
  const cached = practiceImageCache.get(url);
  if (cached) return cached;
  const pending = new Promise<void>((resolve) => {
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
  practiceImageCache.set(url, pending);
  return pending;
}

async function waitForPracticeQuestion(module: ModuleKey, question: BankQuestion) {
  await Promise.all(practiceImageAssets(module, question).map(preloadPracticeImage));
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  });
}

function preloadPracticeQueue(session: SavedSession, fromIndex = session.current) {
  const ids = session.questionIds.slice(
    fromIndex,
    Math.min(session.questionIds.length, fromIndex + preloadAheadCount + 1),
  );
  const urls = ids.flatMap((id) => {
    const question = questionFor(session.module, id);
    return question ? practiceImageAssets(session.module, question) : [];
  });
  void Promise.all([...new Set(urls)].map(preloadPracticeImage));
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

function normalizeSessions(value: unknown) {
  const normalized: Record<string, SavedSession> = {};
  if (!value || typeof value !== "object") return normalized;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const parsed = raw as SavedSession;
    if (
      !["graphic", "material", "verbal"].includes(parsed.module) ||
      !["normal", "wrong", "favorite"].includes(parsed.context)
    ) {
      continue;
    }
    const validIds =
      parsed.questionIds?.filter((id) => Boolean(questionFor(parsed.module, id))) ?? [];
    if (!validIds.length) continue;
    normalized[key] = {
      ...parsed,
      questionIds: validIds,
      current: Math.min(Math.max(0, parsed.current ?? 0), validIds.length - 1),
      selected: parsed.selected ?? {},
      submitted: parsed.submitted ?? {},
      questionTimes: parsed.questionTimes ?? {},
      currentSeconds: Math.max(0, parsed.currentSeconds ?? 0),
    };
  }
  return normalized;
}

function mergeFavorites(value: unknown): FavoriteState {
  if (!value || typeof value !== "object") return initialFavorites;
  const parsed = value as Partial<FavoriteState>;
  return {
    graphic: [...new Set(parsed.graphic?.filter((id) => graphicById.has(id)) ?? [])],
    material: [...new Set(parsed.material?.filter((id) => materialById.has(id)) ?? [])],
    verbal: [...new Set(parsed.verbal?.filter((id) => verbalById.has(id)) ?? [])],
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

function FeatureIcon({ kind }: { kind: "practice" | "mock" | "wrong" | "favorite" }) {
  if (kind === "practice") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect x="6" y="5" width="19" height="22" rx="4" />
        <path d="M11 11h9M11 16h5" />
        <path d="m17.5 21 2.2 2.2 4.4-5" />
      </svg>
    );
  }
  if (kind === "mock") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M12 4h8M16 4v4" />
        <circle cx="16" cy="18" r="9" />
        <path d="M16 12v6l4 2M24 10l2-2" />
      </svg>
    );
  }
  if (kind === "wrong") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M8 5h14a3 3 0 0 1 3 3v18H11a3 3 0 0 1-3-3Z" />
        <path d="M12 10h8M12 14h5M14 20l5 5M19 20l-5 5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M9 5h14v22l-7-4-7 4Z" />
      <path d="m16 9 1.5 3 3.3.5-2.4 2.3.6 3.2-3-1.5-3 1.5.6-3.2-2.4-2.3 3.3-.5Z" />
    </svg>
  );
}

function FeatureSketch({ kind }: { kind: "practice" | "mock" | "wrong" | "favorite" }) {
  if (kind === "practice") {
    return (
      <svg viewBox="0 0 96 64" aria-hidden="true">
        <path d="M10 17a3 3 0 0 1 3-3h31v43H13a3 3 0 0 1-3-3Z" />
        <path d="M18 25h17M18 32h17M18 39h17M18 46h17" />
        <path d="M44 57V10a3 3 0 0 1 3-3h27a3 3 0 0 1 3 3v12h6a3 3 0 0 1 3 3v29a3 3 0 0 1-3 3Z" />
        <path d="M77 22H54" />
        <path d="m54 39 8 8 15-18" />
        <path d="M54 52h23" />
      </svg>
    );
  }
  if (kind === "mock") {
    return (
      <svg viewBox="0 0 96 64" aria-hidden="true">
        <rect x="7" y="20" width="28" height="35" rx="3" />
        <rect x="12" y="27" width="18" height="20" rx="1" />
        <path d="M15 31h12M15 35h12M15 39h12M15 43h9" />
        <path d="M56 8h18M61 4h8M65 4v4" />
        <path d="m50 14-5-5a3 3 0 0 1 4-4l6 6M80 14l5-5a3 3 0 0 0-4-4l-6 6" />
        <circle cx="65" cy="35" r="22" />
        <circle cx="65" cy="35" r="17" />
        <path d="M65 22v14l9 7M50 54l-4 5M80 54l4 5" />
        <path d="M48 35h3M79 35h3M65 18v3M65 49v3" />
      </svg>
    );
  }
  if (kind === "wrong") {
    return (
      <svg viewBox="0 0 96 64" aria-hidden="true">
        <circle cx="47" cy="27" r="19" />
        <circle cx="47" cy="27" r="13" opacity=".45" />
        <path d="m61 41 20 17" />
        <path d="m66 43-5 6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 96 64" aria-hidden="true">
      <path d="M13 16h34v39l-17-9-17 9Z" />
      <path d="m30 22 3.5 7 7.5 1-5.5 5.3 1.3 7.5-6.8-3.6-6.8 3.6 1.3-7.5-5.5-5.3 7.5-1Z" />
      <path d="M56 18h26a4 4 0 0 1 4 4v33H56Z" />
      <path d="M63 28h16M63 36h12M63 44h15" />
    </svg>
  );
}

function SiteNav({
  onHome,
  onPractice,
  onProfile,
  onSearch,
  showCta = true,
}: {
  onHome: () => void;
  onPractice: () => void;
  onProfile?: () => void;
  onSearch?: () => void;
  showCta?: boolean;
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
        <span>北森题库 · 大厂行测专项练习</span>
      </div>
      {onSearch && (
        <button className="nav-icon-button" type="button" onClick={onSearch} aria-label="搜索题库">⌕</button>
      )}
      {onProfile && (
        <button className="profile-entry" type="button" onClick={onProfile}>我的</button>
      )}
      {showCta && (
        <button className="nav-cta" type="button" onClick={onPractice}>开始刷题</button>
      )}
    </nav>
  );
}

function BottomNav({
  current,
  onHome,
  onPractice,
  onMock,
  onProfile,
}: {
  current: "home" | "bank" | "mock" | "profile";
  onHome: () => void;
  onPractice: () => void;
  onMock: () => void;
  onProfile: () => void;
}) {
  const items = [
    { key: "home", icon: "⌂", label: "首页", action: onHome },
    { key: "bank", icon: "▣", label: "题库", action: onPractice },
    { key: "mock", icon: "◷", label: "模考", action: onMock },
    { key: "profile", icon: "☺", label: "我的", action: onProfile },
  ] as const;
  return (
    <nav className="bottom-nav" aria-label="底部导航">
      {items.map((item) => (
        <button
          className={current === item.key ? "active" : ""}
          type="button"
          key={item.key}
          onClick={item.action}
        >
          <span>{item.icon}</span><small>{item.label}</small>
        </button>
      ))}
    </nav>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [activeSession, setActiveSession] = useState<SavedSession | null>(null);
  const [savedSessions, setSavedSessions] = useState<Record<string, SavedSession>>({});
  const [performance, setPerformance] = useState<PerformanceState>(initialPerformance);
  const [favorites, setFavorites] = useState<FavoriteState>(initialFavorites);
  const [persistenceLoaded, setPersistenceLoaded] = useState(false);
  const [cloudSyncReady, setCloudSyncReady] = useState(false);
  const [wrongModule, setWrongModule] = useState<ModuleKey>("graphic");
  const [practiceQuestionReady, setPracticeQuestionReady] = useState(false);
  const practiceTimerEnabledRef = useRef(false);
  const activeSessionRef = useRef<SavedSession | null>(null);
  const cloudPayloadRef = useRef<CloudPracticePayload | null>(null);
  const lastCloudUpdatedAtRef = useRef("");

  const activeId =
    activeSession?.questionIds[activeSession.current] ?? questions[0].sourceId;
  const activeQuestion = activeSession
    ? questionFor(activeSession.module, activeId)
    : questions[0];
  const answered = Boolean(activeSession?.submitted[activeId]);
  const activeModule = activeSession?.module;
  const activeSessionRevision = activeSession
    ? JSON.stringify([
        activeSession.module,
        activeSession.context,
        activeSession.questionIds,
        activeSession.current,
        activeSession.selected,
        activeSession.submitted,
        activeSession.questionTimes,
      ])
    : "";
  const preloadSessionRevision = activeSession
    ? `${activeSession.module}:${activeSession.current}:${activeSession.questionIds.join("|")}`
    : "";

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

  const totalAttempts = (Object.keys(performance) as ModuleKey[]).reduce(
    (sum, module) => sum + performance[module].attempts,
    0,
  );
  const totalCorrect = (Object.keys(performance) as ModuleKey[]).reduce(
    (sum, module) => sum + performance[module].correct,
    0,
  );
  const totalFavorites = (Object.keys(favorites) as ModuleKey[]).reduce(
    (sum, module) => sum + favorites[module].length,
    0,
  );
  const currentSessionAnswered = activeSession
    ? Object.keys(activeSession.submitted).length
    : 0;

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const localSessions: Record<string, SavedSession> = {};
      for (const key of Object.values(sessionStorageKeys)) {
        try {
          const raw = window.localStorage.getItem(key);
          if (raw) Object.assign(localSessions, normalizeSessions({ [key]: JSON.parse(raw) }));
        } catch {
          window.localStorage.removeItem(key);
        }
      }
      let localPerformance = initialPerformance;
      let localFavorites = initialFavorites;
      try {
        const raw = window.localStorage.getItem(performanceStorageKey);
        if (raw) localPerformance = mergePerformance(JSON.parse(raw));
      } catch {
        window.localStorage.removeItem(performanceStorageKey);
      }
      try {
        const raw = window.localStorage.getItem(favoritesStorageKey);
        if (raw) localFavorites = mergeFavorites(JSON.parse(raw));
      } catch {
        window.localStorage.removeItem(favoritesStorageKey);
      }

      let sessions = localSessions;
      let nextPerformance = localPerformance;
      let nextFavorites = localFavorites;
      const localUpdatedAt =
        window.localStorage.getItem(cloudProgressUpdatedAtKey) ?? "";
      lastCloudUpdatedAtRef.current = localUpdatedAt;
      try {
        const response = await fetch("/api/progress", { cache: "no-store" });
        if (response.ok) {
          const result = (await response.json()) as {
            payload?: CloudPracticePayload | null;
            updatedAt?: string | null;
          };
          if (
            result.payload &&
            result.updatedAt &&
            (!localUpdatedAt || result.updatedAt >= localUpdatedAt)
          ) {
            sessions = normalizeSessions(result.payload.sessions);
            nextPerformance = mergePerformance(result.payload.performance);
            nextFavorites = mergeFavorites(result.payload.favorites);
            lastCloudUpdatedAtRef.current = result.updatedAt;
            window.localStorage.setItem(cloudProgressUpdatedAtKey, result.updatedAt);
          }
        }
      } catch {
        // Offline/local preview keeps the most recent device copy.
      }
      if (cancelled) return;
      setSavedSessions(sessions);
      setPerformance(nextPerformance);
      setFavorites(nextFavorites);
      setPersistenceLoaded(true);
      setCloudSyncReady(true);
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!persistenceLoaded) return;
    window.localStorage.setItem(performanceStorageKey, JSON.stringify(performance));
  }, [performance, persistenceLoaded]);

  useEffect(() => {
    if (!persistenceLoaded) return;
    window.localStorage.setItem(favoritesStorageKey, JSON.stringify(favorites));
  }, [favorites, persistenceLoaded]);

  useEffect(() => {
    if (!activeSession || !persistenceLoaded) return;
    const key = storageKey(activeSession.module, activeSession.context);
    window.localStorage.setItem(key, JSON.stringify(activeSession));
  }, [activeSession, persistenceLoaded]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    if (!persistenceLoaded || !cloudSyncReady) return;
    const sessions = { ...savedSessions };
    const currentSession = activeSessionRef.current;
    if (currentSession) {
      sessions[storageKey(currentSession.module, currentSession.context)] = currentSession;
    }
    const payload: CloudPracticePayload = { sessions, performance, favorites };
    cloudPayloadRef.current = payload;
    const localUpdatedAt = new Date().toISOString();
    window.localStorage.setItem(cloudProgressUpdatedAtKey, localUpdatedAt);
    const timer = window.setTimeout(() => {
      fetch("/api/progress", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload }),
        keepalive: true,
      })
        .then((response) => (response.ok ? response.json() : Promise.reject()))
        .then((result: { updatedAt?: string }) => {
          if (!result.updatedAt) return;
          lastCloudUpdatedAtRef.current = result.updatedAt;
          window.localStorage.setItem(cloudProgressUpdatedAtKey, result.updatedAt);
        })
        .catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    activeSessionRevision,
    savedSessions,
    performance,
    favorites,
    persistenceLoaded,
    cloudSyncReady,
  ]);

  useEffect(() => {
    if (!activeSession) return;
    const flush = () => {
      window.localStorage.setItem(
        storageKey(activeSession.module, activeSession.context),
        JSON.stringify(activeSession),
      );
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
        const payload = cloudPayloadRef.current;
        if (payload) {
          fetch("/api/progress", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ payload }),
            keepalive: true,
          }).catch(() => undefined);
        }
      }
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [activeSession]);

  useEffect(() => {
    if (!cloudSyncReady) return;
    let pulling = false;
    const pullLatest = async () => {
      if (pulling || document.visibilityState === "hidden") return;
      pulling = true;
      try {
        const response = await fetch("/api/progress", { cache: "no-store" });
        if (!response.ok) return;
        const result = (await response.json()) as {
          payload?: CloudPracticePayload | null;
          updatedAt?: string | null;
        };
        if (
          !result.payload ||
          !result.updatedAt ||
          result.updatedAt <= lastCloudUpdatedAtRef.current
        ) {
          return;
        }
        const sessions = normalizeSessions(result.payload.sessions);
        setSavedSessions(sessions);
        setPerformance(mergePerformance(result.payload.performance));
        setFavorites(mergeFavorites(result.payload.favorites));
        setActiveSession((current) => {
          if (!current) return current;
          return sessions[storageKey(current.module, current.context)] ?? current;
        });
        lastCloudUpdatedAtRef.current = result.updatedAt;
        window.localStorage.setItem(cloudProgressUpdatedAtKey, result.updatedAt);
      } catch {
        // The local copy remains usable while offline.
      } finally {
        pulling = false;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void pullLatest();
    };
    window.addEventListener("focus", pullLatest);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", pullLatest);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [cloudSyncReady]);

  useEffect(() => {
    if (screen !== "practice" || !activeModule || !activeQuestion) {
      practiceTimerEnabledRef.current = false;
      return;
    }
    let cancelled = false;
    practiceTimerEnabledRef.current = false;
    waitForPracticeQuestion(activeModule, activeQuestion).then(() => {
      if (cancelled) return;
      practiceTimerEnabledRef.current = true;
      setPracticeQuestionReady(true);
    });
    return () => {
      cancelled = true;
      practiceTimerEnabledRef.current = false;
    };
  }, [screen, activeId, activeModule, activeQuestion]);

  useEffect(() => {
    const currentSession = activeSessionRef.current;
    if (screen !== "practice" || !currentSession) return;
    preloadPracticeQueue(currentSession, currentSession.current + 1);
  }, [
    screen,
    preloadSessionRevision,
  ]);

  useEffect(() => {
    if (
      screen !== "practice" ||
      answered ||
      !activeModule ||
      !practiceQuestionReady
    ) {
      return;
    }
    const startedAt = Date.now();
    let appliedSeconds = 0;
    const timer = window.setInterval(() => {
      if (!practiceTimerEnabledRef.current) return;
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      const delta = elapsedSeconds - appliedSeconds;
      if (delta <= 0) return;
      appliedSeconds = elapsedSeconds;
      setActiveSession((session) =>
        session
          ? { ...session, currentSeconds: session.currentSeconds + delta }
          : session,
      );
    }, 250);
    return () => window.clearInterval(timer);
  }, [screen, answered, activeId, activeModule, practiceQuestionReady]);

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
    if (activeSession) {
      setSavedSessions((sessions) => ({
        ...sessions,
        [storageKey(activeSession.module, activeSession.context)]: activeSession,
      }));
    }
    practiceTimerEnabledRef.current = false;
    setPracticeQuestionReady(false);
    const session = emptySession(module, context, pool);
    preloadPracticeQueue(session, 0);
    setActiveSession(session);
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
    if (activeSession) {
      setSavedSessions((sessions) => ({
        ...sessions,
        [storageKey(activeSession.module, activeSession.context)]: activeSession,
      }));
    }
    const currentSourceId = saved.questionIds[saved.current];
    const validIds = saved.questionIds.filter(
      (id) => Boolean(questionFor(module, id)) && (!allowedIds || allowedIds.has(id)),
    );
    if (!validIds.length) return false;
    const currentIndex = validIds.indexOf(currentSourceId);
    const current = currentIndex >= 0 ? currentIndex : Math.min(saved.current, validIds.length - 1);
    practiceTimerEnabledRef.current = false;
    setPracticeQuestionReady(false);
    const session = { ...saved, module, context, questionIds: validIds, current };
    preloadPracticeQueue(session, current);
    setActiveSession(session);
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
    practiceTimerEnabledRef.current = false;
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
    practiceTimerEnabledRef.current = false;
    setPracticeQuestionReady(false);
    setActiveSession({
      ...activeSession,
      current: next,
      currentSeconds: activeSession.questionTimes[nextId] ?? 0,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function previousQuestion() {
    if (!activeSession || activeSession.current <= 0) return;
    const previous = activeSession.current - 1;
    const previousId = activeSession.questionIds[previous];
    practiceTimerEnabledRef.current = false;
    setPracticeQuestionReady(false);
    setActiveSession({
      ...activeSession,
      current: previous,
      currentSeconds: activeSession.questionTimes[previousId] ?? 0,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function practiceBackScreen() {
    if (activeSession?.context === "wrong") return "wrong-dashboard";
    if (activeSession?.context === "favorite") return "favorite-categories";
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

  function toggleFavorite(module: ModuleKey, sourceId: string) {
    setFavorites((current) => {
      const ids = new Set(current[module]);
      if (ids.has(sourceId)) ids.delete(sourceId);
      else ids.add(sourceId);
      return { ...current, [module]: [...ids] };
    });
  }

  function startFavoritePractice(module: ModuleKey) {
    const favoriteIds = new Set(favorites[module]);
    if (!favoriteIds.size) return;
    if (resumeSession(module, "favorite", favoriteIds)) return;
    const pool = bankFor(module).filter((question) =>
      favoriteIds.has(question.sourceId),
    );
    startSession(module, pool, "favorite");
  }

  function recordMockOutcomes(
    outcomes: Array<{ module: ModuleKey; sourceId: string; isCorrect: boolean }>,
  ) {
    setPerformance((state) => {
      const next: PerformanceState = {
        graphic: { ...state.graphic, wrongIds: [...state.graphic.wrongIds] },
        material: { ...state.material, wrongIds: [...state.material.wrongIds] },
        verbal: { ...state.verbal, wrongIds: [...state.verbal.wrongIds] },
      };
      const wrongSets: Record<ModuleKey, Set<string>> = {
        graphic: new Set(next.graphic.wrongIds),
        material: new Set(next.material.wrongIds),
        verbal: new Set(next.verbal.wrongIds),
      };
      for (const outcome of outcomes) {
        next[outcome.module].attempts += 1;
        if (outcome.isCorrect) {
          next[outcome.module].correct += 1;
        } else {
          wrongSets[outcome.module].add(outcome.sourceId);
        }
      }
      for (const moduleKey of ["graphic", "material", "verbal"] as ModuleKey[]) {
        next[moduleKey].wrongIds = [...wrongSets[moduleKey]];
      }
      return next;
    });
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
      <main className="inner-page overview-page categories-page has-bottom-nav">
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
            <h2><span className="module-emoji" aria-hidden="true">🧩</span>图形推理</h2>
            <p>北森题库去重后共 {questions.length} 题，保留 Excel 原题号。</p>
            <strong>进入题库 →</strong>
          </button>
          <button
            className="category-card active-card material-category-card"
            type="button"
            onClick={() => startMaterialPractice(false)}
          >
            <span>02</span><h2><span className="module-emoji" aria-hidden="true">📊</span>材料分析</h2>
            <p>北森图表分析去重后共 {materialQuestions.length} 题，按原题顺序练习。</p>
            <strong>
              {savedMaterial
                ? `继续上次进度 · 已完成 ${Object.keys(savedMaterial.submitted ?? {}).length} 题 →`
                : "进入题库 →"}
            </strong>
          </button>
          <button className="category-card active-card" type="button" onClick={() => goTo("verbal-mode")}>
            <span>03</span><h2><span className="module-emoji" aria-hidden="true">💬</span>文字推理</h2>
            <p>北森言语理解去重后共 {verbalQuestions.length} 题，均已标注题型、考点和难度。</p>
            <strong>进入题库 →</strong>
          </button>
        </section>
        <BottomNav current="bank" onHome={goHome} onPractice={() => goTo("categories")} onMock={() => goTo("mock")} onProfile={() => goTo("profile")} />
      </main>
    );
  }

  if (screen === "graphic-mode") {
    return (
      <main className="inner-page overview-page mode-overview-page graphic-mode-page has-bottom-nav">
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
        <BottomNav current="bank" onHome={goHome} onPractice={() => goTo("categories")} onMock={() => goTo("mock")} onProfile={() => goTo("profile")} />
      </main>
    );
  }

  if (screen === "verbal-mode") {
    return (
      <main className="inner-page overview-page mode-overview-page verbal-mode-page has-bottom-nav">
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
        <BottomNav current="bank" onHome={goHome} onPractice={() => goTo("categories")} onMock={() => goTo("mock")} onProfile={() => goTo("profile")} />
      </main>
    );
  }

  if (screen === "wrong-categories") {
    return (
      <main className="inner-page overview-page category-overview-page wrong-categories-page has-bottom-nav">
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
              <h2><span className="module-emoji" aria-hidden="true">{moduleIcons[module]}</span>{moduleNames[module]}</h2>
              <p>累计作答 {performance[module].attempts} 次，当前错题 {performance[module].wrongIds.length} 道。</p>
              <strong>查看评估与错题 →</strong>
            </button>
          ))}
        </section>
        <BottomNav current="home" onHome={goHome} onPractice={() => goTo("categories")} onMock={() => goTo("mock")} onProfile={() => goTo("profile")} />
      </main>
    );
  }

  if (screen === "favorite-categories") {
    return (
      <main className="inner-page overview-page category-overview-page favorite-categories-page has-bottom-nav">
        <SiteNav onHome={goHome} onPractice={() => goTo("categories")} />
        <section className="page-heading">
          <button className="back-link" type="button" onClick={goHome}>← 返回首页</button>
          <span className="eyebrow">FAVORITES</span>
          <h1>我的收藏夹</h1>
          <p>做题时点击黄色星星即可收藏；收藏题会按模块同步到手机和电脑。</p>
        </section>
        <section className="category-grid">
          {(["graphic", "material", "verbal"] as ModuleKey[]).map((module, index) => (
            <button
              className="category-card active-card favorite-category-card"
              type="button"
              key={module}
              disabled={!favorites[module].length}
              onClick={() => startFavoritePractice(module)}
            >
              <span>0{index + 1}</span>
              <h2><span className="module-emoji" aria-hidden="true">{moduleIcons[module]}</span>{moduleNames[module]}</h2>
              <p>当前收藏 {favorites[module].length} 道，答对后仍会保留，可反复训练。</p>
              <strong>
                {favorites[module].length ? "进入收藏题练习 →" : "暂时没有收藏"}
              </strong>
            </button>
          ))}
        </section>
        <BottomNav current="profile" onHome={goHome} onPractice={() => goTo("categories")} onMock={() => goTo("mock")} onProfile={() => goTo("profile")} />
      </main>
    );
  }

  if (screen === "wrong-dashboard") {
    const stats = performance[wrongModule];
    const accuracy = stats.attempts
      ? Math.round((stats.correct / stats.attempts) * 100)
      : 0;
    return (
      <main className="inner-page wrong-dashboard-page overview-page has-bottom-nav">
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
        <BottomNav current="profile" onHome={goHome} onPractice={() => goTo("categories")} onMock={() => goTo("mock")} onProfile={() => goTo("profile")} />
      </main>
    );
  }

  if (screen === "profile") {
    const accuracy = totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
    const progressItems = [
      { module: "graphic" as const, label: "图形推理", total: questions.length },
      { module: "material" as const, label: "材料分析", total: materialQuestions.length },
      { module: "verbal" as const, label: "文字推理", total: verbalQuestions.length },
    ];
    return (
      <main className="inner-page profile-page overview-page has-bottom-nav">
        <SiteNav onHome={goHome} onPractice={() => goTo("categories")} />
        <section className="profile-shell">
          <button className="back-link profile-back" type="button" onClick={goHome}>← 返回首页</button>
          <article className="profile-hero-card">
            <div className="profile-avatar">秋</div>
            <div><span>我的学习档案</span><h1>秋招同学</h1><p>Lv.1 · 笔试新手　<em>同账号进度自动同步</em></p></div>
            <button type="button">编辑资料</button>
          </article>
          <section className="profile-stats" aria-label="刷题数据">
            <article><span>累计做题</span><strong>{totalAttempts}</strong></article>
            <article><span>本次进度</span><strong>{currentSessionAnswered}</strong></article>
            <article><span>正确率</span><strong>{accuracy}%</strong></article>
            <article><span>收藏题目</span><strong>{totalFavorites}</strong></article>
          </section>
          <div className="profile-columns">
            <section className="profile-panel learning-links">
              <div className="section-line"><span>学习记录</span><small>自动保存</small></div>
              <button type="button" onClick={() => goTo("wrong-categories")}><b>🧩</b><span>错题集<small>集中复盘薄弱题</small></span><em>›</em></button>
              <button type="button" onClick={() => goTo("favorite-categories")}><b>☆</b><span>收藏夹<small>反复训练犹豫题</small></span><em>›</em></button>
              <button type="button" onClick={() => goTo("mock")}><b>◷</b><span>模考记录<small>回看限时考试表现</small></span><em>›</em></button>
            </section>
            <section className="profile-panel progress-panel">
              <div className="section-line"><span>北森备考进度</span><small>按作答次数估算</small></div>
              {progressItems.map((item) => {
                const percent = Math.min(100, Math.round((performance[item.module].attempts / item.total) * 100));
                return <div className="profile-progress" key={item.module}><p><span>{item.label}</span><strong>{percent}%</strong></p><i><b style={{ width: `${percent}%` }} /></i></div>;
              })}
            </section>
          </div>
        </section>
        <BottomNav current="profile" onHome={goHome} onPractice={() => goTo("categories")} onMock={() => goTo("mock")} onProfile={() => goTo("profile")} />
      </main>
    );
  }

  if (screen === "mock") {
    return (
      <MockExam
        onHome={goHome}
        onPractice={() => goTo("categories")}
        onProfile={() => goTo("profile")}
        onComplete={recordMockOutcomes}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
      />
    );
  }

  if (screen === "practice" && activeSession && activeQuestion) {
    const choice = activeSession.selected[activeId];
    const correctAnswer = answerFor(activeQuestion);
    const isCorrect = activeSession.submitted[activeId] === correctAnswer;
    const optionCount = activeQuestion.optionCount;
    const questionTime =
      activeSession.questionTimes[activeId] ?? activeSession.currentSeconds;
    const isFavorite = favorites[activeSession.module].includes(activeId);
    const groupStart = Math.floor(activeSession.current / 10) * 10;
    const groupEnd = Math.min(
      groupStart + 10,
      activeSession.questionIds.length,
    );
    const groupIndices = Array.from(
      { length: groupEnd - groupStart },
      (_, index) => groupStart + index,
    );
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
              {activeSession.context === "favorite" ? "收藏夹 · " : ""}
              {moduleNames[activeSession.module]} · {activeSession.current + 1}/{activeSession.questionIds.length}
            </span>
          </div>
          <div className="timer" aria-label={`本题用时 ${formatTime(questionTime)}`}>
            <small>{answered ? "本题用时" : "本题计时"}</small>
            <strong>{formatTime(questionTime)}</strong>
          </div>
        </header>

        <section className="practice-question-strip" aria-label="本组题目进度">
          {groupIndices.map((index) => (
            <span
              key={activeSession.questionIds[index]}
              className={
                index < activeSession.current
                  ? "completed"
                  : index === activeSession.current
                    ? "current"
                    : ""
              }
            >
              {index + 1}
            </span>
          ))}
        </section>

        <section className="practice-content">
          <div className="question-meta">
            <span>{activeQuestion.sourceId}</span>
            <span>{activeQuestion.difficulty}</span>
            <em>
              {answered
                ? "已提交 · 本题计时已停止"
                : practiceQuestionReady
                ? "计时中 · 提交前不会显示答案"
                : "新题加载中 · 当前暂停计时"}
            </em>
            <button
              className={`favorite-toggle ${isFavorite ? "is-favorite" : ""}`}
              type="button"
              aria-label={isFavorite ? "取消收藏本题" : "收藏本题"}
              title={isFavorite ? "取消收藏本题" : "收藏本题"}
              onClick={() => toggleFavorite(activeSession.module, activeId)}
            >
              {isFavorite ? "★" : "☆"}
            </button>
          </div>
          <div className={`timed-question-frame ${practiceQuestionReady ? "" : "is-loading"}`}>
          <article
            key={activeId}
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
          {!practiceQuestionReady && (
            <div className="question-loading-mask" role="status">
              <div className="mock-loader" aria-hidden="true"><i /><i /><i /></div>
              <strong>正在载入 {activeId}</strong>
              <span>新题文字和全部图片显示完成后才开始计时</span>
            </div>
          )}
          </div>

          {!answered ? (
            <div className="practice-actions">
              <button
                className="practice-previous"
                type="button"
                onClick={previousQuestion}
                disabled={activeSession.current === 0}
              >
                ← 上一题
              </button>
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
                disabled={!choice || !practiceQuestionReady}
              >
                确认提交
              </button>
            </div>
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
              <div className="analysis-navigation">
                <button
                  className="practice-previous"
                  type="button"
                  onClick={previousQuestion}
                  disabled={activeSession.current === 0}
                >
                  ← 上一题
                </button>
                <button className="next-button" type="button" onClick={nextQuestion}>
                  {activeSession.current === activeSession.questionIds.length - 1
                    ? "查看成绩"
                    : "下一题 →"}
                </button>
              </div>
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
            ) : activeSession.context === "favorite" ? (
              <button className="primary-button" type="button" onClick={() => goTo("favorite-categories")}>
                返回收藏夹
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
    <main className="home-page overview-page has-bottom-nav">
      <section className="hero">
        <article className="hero-banner">
          <div className="hero-copy">
            <span className="hero-label">2026 秋招 · 北森专项题库</span>
            <h1>大厂秋招行测<br /><span>刷题平台</span></h1>
            <p>专项练习北森题库<br />图形推理 · 材料分析 · 文字推理<br /><small>剔除公考无关内容，只练大厂笔试高频题型。</small></p>
          </div>
        </article>
        <div className="hero-actions">
          <button className="hero-action hero-action-primary" type="button" onClick={() => goTo("categories")}>
            <span className="action-sticker"><FeatureIcon kind="practice" /></span><span><strong>分类专项刷题</strong><small>分模块针对性练习</small></span><span className="feature-sketch"><FeatureSketch kind="practice" /></span>
          </button>
          <button className="hero-action hero-action-mock" type="button" onClick={() => goTo("mock")}>
            <span className="action-sticker"><FeatureIcon kind="mock" /></span><span><strong>全真限时模考</strong><small>模拟真实笔试节奏</small></span><span className="feature-sketch"><FeatureSketch kind="mock" /></span>
          </button>
          <button className="hero-action hero-action-wrong" type="button" onClick={() => goTo("wrong-categories")}>
            <span className="action-sticker"><FeatureIcon kind="wrong" /></span><span><strong>错题集</strong><small>自动归集薄弱考点</small></span><span className="feature-sketch"><FeatureSketch kind="wrong" /></span>
          </button>
          <button className="hero-action hero-action-favorite" type="button" onClick={() => goTo("favorite-categories")}>
            <span className="action-sticker"><FeatureIcon kind="favorite" /></span><span><strong>收藏夹</strong><small>反复训练犹豫题</small></span><span className="feature-sketch"><FeatureSketch kind="favorite" /></span>
          </button>
        </div>
      </section>

      <section className="structure-section" id="structure">
        <div className="section-title-row"><div><span className="eyebrow">QUESTION BANK</span><h2>题库分类</h2></div><button type="button" onClick={() => goTo("categories")}>查看更多 →</button></div>
        <div className="home-category-tags">
          <button type="button" onClick={() => goTo("graphic-mode")}><span><i aria-hidden="true">🧩</i>图形推理</span><small>{questions.length} 题</small></button>
          <button type="button" onClick={() => startMaterialPractice(false)}><span><i aria-hidden="true">📊</i>材料分析</span><small>{materialQuestions.length} 题</small></button>
          <button type="button" onClick={() => goTo("verbal-mode")}><span><i aria-hidden="true">💬</i>文字推理</span><small>{verbalQuestions.length} 题</small></button>
        </div>
        <div className="trust-title"><span className="eyebrow">WHY THIS TOOL</span><h2>为什么选择本站</h2></div>
        <section className="trust-panel">
          <div><span>✓</span><strong>定向题库</strong><small>只练大厂笔试内容</small></div>
          <div><span>◷</span><strong>真实计时</strong><small>题目加载后再开始</small></div>
          <div><span>↻</span><strong>错题归档</strong><small>提交后立即保存</small></div>
          <div><span>＋</span><strong>持续更新</strong><small>题库增加即可扩展</small></div>
        </section>
      </section>
      <BottomNav current="home" onHome={goHome} onPractice={() => goTo("categories")} onMock={() => goTo("mock")} onProfile={() => goTo("profile")} />
    </main>
  );
}
