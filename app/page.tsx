"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "./account-context";
import materialQuestionData from "./material-questions.json";
import MockExam from "./mock-exam";
import questionData from "./questions.json";
import RestrictedPage from "./restricted-page";
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
  | "profile"
  | "membership";

const MEMBERSHIP_PROTECTED_SCREENS = new Set<Screen>([
  "categories",
  "graphic-mode",
  "verbal-mode",
  "mock",
  "practice",
  "result",
  "wrong-categories",
  "wrong-dashboard",
  "favorite-categories",
]);

type GraphicQuestion = {
  sourceId: string;
  displayId?: string;
  prompt?: string;
  stemImages?: string[];
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

type ResumeOptions = {
  allowedIds?: Set<string>;
  orderedIds?: string[];
  continueFromFirstUnanswered?: boolean;
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
const orderedGraphicQuestions = [...questions].sort((left, right) =>
  (left.displayId ?? left.sourceId).localeCompare(right.displayId ?? right.sourceId, "zh-CN", {
    numeric: true,
    sensitivity: "base",
  }),
);
const allQuestionImageUrls = [
  ...new Set([
    ...questions.flatMap((question) => [
      ...(question.stemImages?.length ? question.stemImages : [question.image]),
      ...question.optionImages,
    ]).filter(Boolean),
    ...materialQuestions.flatMap((question) =>
      question.image ? [question.image] : [],
    ),
  ]),
];
const priorityQuestionImageUrls = [
  ...new Set([
    ...orderedGraphicQuestions.slice(0, 5).flatMap((question) => [
      ...(question.stemImages?.length ? question.stemImages : [question.image]),
      ...question.optionImages,
    ]).filter(Boolean),
    ...materialQuestions.slice(0, 5).flatMap((question) =>
      question.image ? [question.image] : [],
    ),
  ]),
];
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
const preloadAheadCount = 5;
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
const pieColors = ["#a87d60", "#cbb09e", "#dfd3c3", "#e9ded2", "#f8ede3"];

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

function formatMembershipDate(value: string | null) {
  if (!value) return "未设置";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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
  if (module === "graphic") {
    return (
      graphicById.get(sourceId) ??
      questions.find((question) => question.sourceId === sourceId)
    );
  }
  if (module === "material") {
    return (
      materialById.get(sourceId) ??
      materialQuestions.find((question) => question.sourceId === sourceId)
    );
  }
  return (
    verbalById.get(sourceId) ??
    verbalQuestions.find((question) => question.sourceId === sourceId)
  );
}

function answerFor(question: BankQuestion) {
  return question.answer;
}

function practiceImageAssets(module: ModuleKey, question: BankQuestion) {
  if (module === "graphic") {
    const graphic = question as GraphicQuestion;
    return [
      ...(graphic.stemImages?.length ? graphic.stemImages : [graphic.image]),
      ...graphic.optionImages,
    ].filter(Boolean);
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
    graphic: [
      ...new Set(
        parsed.graphic?.filter((id) => Boolean(questionFor("graphic", id))) ??
          [],
      ),
    ],
    material: [
      ...new Set(
        parsed.material?.filter((id) =>
          Boolean(questionFor("material", id)),
        ) ?? [],
      ),
    ],
    verbal: [
      ...new Set(
        parsed.verbal?.filter((id) => Boolean(questionFor("verbal", id))) ??
          [],
      ),
    ],
  };
}

function favoriteStateFromQuestionIds(questionIds: string[]): FavoriteState {
  return {
    graphic: questionIds.filter(
      (id) => !id.startsWith("材料-") && !id.startsWith("文字-"),
    ),
    material: questionIds.filter((id) => id.startsWith("材料-")),
    verbal: questionIds.filter((id) => id.startsWith("文字-")),
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

function preservePerformance(
  current: PerformanceState,
  incoming: unknown,
): PerformanceState {
  const next = mergePerformance(incoming);
  return (["graphic", "material", "verbal"] as ModuleKey[]).reduce(
    (result, module) => {
      const attempts = Math.max(
        current[module].attempts,
        next[module].attempts,
      );
      result[module] = {
        attempts,
        correct: Math.min(
          attempts,
          Math.max(current[module].correct, next[module].correct),
        ),
        wrongIds: [
          ...new Set([
            ...current[module].wrongIds,
            ...next[module].wrongIds,
          ]),
        ],
      };
      return result;
    },
    {
      graphic: { ...initialPerformance.graphic },
      material: { ...initialPerformance.material },
      verbal: { ...initialPerformance.verbal },
    } as PerformanceState,
  );
}

function preserveFavorites(
  current: FavoriteState,
  incoming: unknown,
): FavoriteState {
  const next = mergeFavorites(incoming);
  return {
    graphic: [...new Set([...current.graphic, ...next.graphic])],
    material: [...new Set([...current.material, ...next.material])],
    verbal: [...new Set([...current.verbal, ...next.verbal])],
  };
}

function sessionProgressScore(session: SavedSession) {
  return (
    Object.keys(session.submitted).length * 1000 +
    Object.keys(session.selected).length * 10 +
    session.current
  );
}

function preserveSessions(
  current: Record<string, SavedSession>,
  incoming: unknown,
) {
  const next = normalizeSessions(incoming);
  const merged = { ...current };
  for (const [key, nextSession] of Object.entries(next)) {
    const currentSession = merged[key];
    if (
      !currentSession ||
      sessionProgressScore(nextSession) > sessionProgressScore(currentSession)
    ) {
      merged[key] = nextSession;
    }
  }
  return merged;
}

function preservePracticePayload(
  current: CloudPracticePayload,
  incoming: unknown,
): CloudPracticePayload {
  const next =
    incoming && typeof incoming === "object"
      ? (incoming as Partial<CloudPracticePayload>)
      : {};
  return {
    sessions: preserveSessions(current.sessions, next.sessions),
    performance: preservePerformance(current.performance, next.performance),
    favorites: preserveFavorites(current.favorites, next.favorites),
  };
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
        <img className="brand-mark-image" src="/offer-assets/brand-mark.svg" alt="" />
        <strong className="brand-wordmark">Offer Fawn</strong>
      </button>
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
    { key: "home", label: "首页", action: onHome },
    { key: "bank", label: "题库", action: onPractice },
    { key: "mock", label: "模考", action: onMock },
    { key: "profile", label: "我的", action: onProfile },
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
          <img className="nav-deer-icon" src="/offer-assets/nav-deer-head.svg" alt="" />
          <small>{item.label}</small>
        </button>
      ))}
    </nav>
  );
}

export default function Home() {
  const account = useAccount();
  const { saveUserState } = account;
  const [screen, setScreen] = useState<Screen>("home");
  const [activeSession, setActiveSession] = useState<SavedSession | null>(null);
  const [savedSessions, setSavedSessions] = useState<Record<string, SavedSession>>({});
  const [performance, setPerformance] = useState<PerformanceState>(initialPerformance);
  const [favorites, setFavorites] = useState<FavoriteState>(initialFavorites);
  const [persistenceLoaded, setPersistenceLoaded] = useState(false);
  const [cloudSyncReady, setCloudSyncReady] = useState(false);
  const [accountStateReadyFor, setAccountStateReadyFor] = useState<
    string | null
  >(null);
  const [wrongModule, setWrongModule] = useState<ModuleKey>("graphic");
  const [practiceQuestionReady, setPracticeQuestionReady] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileEditError, setProfileEditError] = useState("");
  const [profileReferenceTime] = useState(() => Date.now());
  const practiceTimerEnabledRef = useRef(false);
  const activeSessionRef = useRef<SavedSession | null>(null);
  const cloudPayloadRef = useRef<CloudPracticePayload | null>(null);
  const lastCloudUpdatedAtRef = useRef("");
  const appliedAccountStateRef = useRef("");

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
  const lastSavedPractice =
    [savedGraphic, savedMaterial, savedVerbal]
      .filter((session): session is SavedSession => Boolean(session))
      .sort((left, right) => sessionProgressScore(right) - sessionProgressScore(left))[0] ??
    null;

  const combinedPerformance = useMemo<PerformanceState>(() => {
    const cloudProgress: PerformanceState = {
      graphic: { attempts: 0, correct: 0, wrongIds: [] },
      material: { attempts: 0, correct: 0, wrongIds: [] },
      verbal: { attempts: 0, correct: 0, wrongIds: [] },
    };
    const resolvedQuestionIds = new Set<string>();

    for (const item of account.questionProgress) {
      const moduleKey: ModuleKey = item.question_id.startsWith("材料-")
        ? "material"
        : item.question_id.startsWith("文字-")
          ? "verbal"
          : "graphic";
      cloudProgress[moduleKey].attempts += item.attempts;
      cloudProgress[moduleKey].correct += item.correct_attempts;
      if (item.is_correct) {
        resolvedQuestionIds.add(item.question_id);
      } else {
        cloudProgress[moduleKey].wrongIds.push(item.question_id);
      }
    }

    return (["graphic", "material", "verbal"] as ModuleKey[]).reduce(
      (result, module) => {
        const current = performance[module];
        const exam = account.examPerformance[module];
        const cloud = cloudProgress[module];
        const attempts = Math.max(
          current.attempts,
          exam.attempts + cloud.attempts,
        );
        const wrongIds = new Set([
          ...current.wrongIds,
          ...exam.wrongIds,
          ...cloud.wrongIds,
        ]);
        for (const questionId of resolvedQuestionIds) {
          wrongIds.delete(questionId);
        }
        result[module] = {
          attempts,
          correct: Math.min(
            attempts,
            Math.max(current.correct, exam.correct + cloud.correct),
          ),
          wrongIds: [...wrongIds],
        };
        return result;
      },
      {
        graphic: { attempts: 0, correct: 0, wrongIds: [] },
        material: { attempts: 0, correct: 0, wrongIds: [] },
        verbal: { attempts: 0, correct: 0, wrongIds: [] },
      } as PerformanceState,
    );
  }, [account.examPerformance, account.questionProgress, performance]);

  const visiblePerformance = account.session
    ? combinedPerformance
    : performance;
  const cloudFavorites = useMemo(
    () => favoriteStateFromQuestionIds(account.favoriteQuestionIds),
    [account.favoriteQuestionIds],
  );
  const visibleFavorites =
    account.session && account.favoritesLoaded ? cloudFavorites : favorites;
  const totalAttempts = (Object.keys(visiblePerformance) as ModuleKey[]).reduce(
    (sum, module) => sum + visiblePerformance[module].attempts,
    0,
  );
  const totalCorrect = (Object.keys(visiblePerformance) as ModuleKey[]).reduce(
    (sum, module) => sum + visiblePerformance[module].correct,
    0,
  );
  const currentSessionAnswered = activeSession
    ? Object.keys(activeSession.submitted).length
    : 0;

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const registration = await navigator.serviceWorker.register(
            "/question-cache-sw.js",
            { scope: "/" },
          );
          const ready = await navigator.serviceWorker.ready;
          let version = "fallback-v1";
          try {
            const response = await fetch("/question-cache-version.json", {
              cache: "no-store",
            });
            if (response.ok) {
              const payload = (await response.json()) as { version?: string };
              if (payload.version) version = payload.version;
            }
          } catch {
            // A missing version file only affects cache rotation, not practice.
          }
          if (cancelled) return;
          const worker =
            ready.active ??
            registration.active ??
            navigator.serviceWorker.controller;
          worker?.postMessage({
            type: "CACHE_QUESTION_IMAGES",
            version,
            priorityUrls: priorityQuestionImageUrls,
            urls: allQuestionImageUrls,
          });
        } catch {
          // Browsers without persistent service-worker storage keep normal loading.
        }
      })();
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

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
          if (result.payload && result.updatedAt) {
            const merged = preservePracticePayload(
              {
                sessions,
                performance: nextPerformance,
                favorites: nextFavorites,
              },
              result.payload,
            );
            sessions = merged.sessions;
            nextPerformance = merged.performance;
            nextFavorites = merged.favorites;
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
    window.localStorage.setItem(
      favoritesStorageKey,
      JSON.stringify(visibleFavorites),
    );
  }, [visibleFavorites, persistenceLoaded]);

  useEffect(() => {
    if (!activeSession || !persistenceLoaded) return;
    const key = storageKey(activeSession.module, activeSession.context);
    window.localStorage.setItem(key, JSON.stringify(activeSession));
  }, [activeSession, persistenceLoaded]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    if (!persistenceLoaded || account.loading) return;
    const userId = account.session?.user.id;
    const timer = window.setTimeout(() => {
      if (!userId) {
        setAccountStateReadyFor("anonymous");
        return;
      }

      if (!account.userStateLoaded) return;
      const stateKey = `${userId}:${account.userStateUpdatedAt ?? "empty"}`;
      if (appliedAccountStateRef.current === stateKey) {
        setAccountStateReadyFor(userId);
        return;
      }

      const merged = preservePracticePayload(
        { sessions: savedSessions, performance, favorites },
        account.userState,
      );
      setSavedSessions(merged.sessions);
      setPerformance(merged.performance);
      setFavorites(merged.favorites);
      cloudPayloadRef.current = merged;
      if (account.userStateUpdatedAt) {
        window.localStorage.setItem(
          cloudProgressUpdatedAtKey,
          account.userStateUpdatedAt,
        );
      }
      appliedAccountStateRef.current = stateKey;
      setAccountStateReadyFor(userId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    account.loading,
    account.session,
    account.userState,
    account.userStateUpdatedAt,
    account.userStateLoaded,
    persistenceLoaded,
    savedSessions,
    performance,
    favorites,
  ]);

  useEffect(() => {
    if (!persistenceLoaded || !cloudSyncReady) return;
    const userId = account.session?.user.id;
    if (
      account.loading ||
      (userId && !account.userStateLoaded) ||
      (userId && accountStateReadyFor !== userId)
    ) {
      return;
    }
    const sessions = { ...savedSessions };
    const currentSession = activeSessionRef.current;
    if (currentSession) {
      sessions[storageKey(currentSession.module, currentSession.context)] = currentSession;
    }
    const payload: CloudPracticePayload = {
      sessions,
      performance,
      favorites: visibleFavorites,
    };
    cloudPayloadRef.current = payload;
    const timer = window.setTimeout(() => {
      void saveUserState(payload).then((updatedAt) => {
        if (!updatedAt) return;
        lastCloudUpdatedAtRef.current = updatedAt;
        window.localStorage.setItem(cloudProgressUpdatedAtKey, updatedAt);
      });
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
    visibleFavorites,
    persistenceLoaded,
    cloudSyncReady,
    account.loading,
    account.session,
    account.userStateLoaded,
    accountStateReadyFor,
    saveUserState,
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
        setSavedSessions((current) =>
          preserveSessions(current, result.payload?.sessions),
        );
        setPerformance((current) =>
          preservePerformance(current, result.payload?.performance),
        );
        setFavorites((current) =>
          preserveFavorites(current, result.payload?.favorites),
        );
        setActiveSession((current) => {
          if (!current) return current;
          const sessions = normalizeSessions(result.payload?.sessions);
          const incoming =
            sessions[storageKey(current.module, current.context)];
          return incoming &&
            sessionProgressScore(incoming) > sessionProgressScore(current)
            ? incoming
            : current;
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
    if (!MEMBERSHIP_PROTECTED_SCREENS.has(screen)) return;
    if (!account.session) {
      setScreen("home");
      account.openAuth();
      return;
    }
    if (!account.hasAccess) setScreen("membership");
  }, [account.hasAccess, account.openAuth, account.session, screen]);

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
    if (MEMBERSHIP_PROTECTED_SCREENS.has(nextScreen) && !account.session) {
      account.openAuth();
      return;
    }
    if (MEMBERSHIP_PROTECTED_SCREENS.has(nextScreen) && !account.hasAccess) {
      setScreen("membership");
      return;
    }
    setScreen(nextScreen);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openProfileEditor() {
    if (!account.session) {
      account.openAuth();
      return;
    }
    const metadataFullName =
      typeof account.session.user.user_metadata?.full_name === "string"
        ? account.session.user.user_metadata.full_name
        : "";
    setProfileNameDraft(account.profile?.full_name ?? metadataFullName);
    setProfileEditError("");
    setProfileEditing(true);
  }

  async function saveProfileName() {
    const fullName = profileNameDraft.trim();
    if (!fullName) {
      setProfileEditError("请输入姓名或昵称");
      return;
    }
    setProfileSaving(true);
    setProfileEditError("");
    try {
      await account.updateFullName(fullName);
      setProfileEditing(false);
    } catch (error) {
      setProfileEditError(
        error instanceof Error ? error.message : "资料保存失败，请稍后重试",
      );
    } finally {
      setProfileSaving(false);
    }
  }

  function startSession(
    module: ModuleKey,
    pool: BankQuestion[],
    context: PracticeContext = "normal",
  ) {
    if (!pool.length) return;
    if (!account.session) {
      account.openAuth();
      return;
    }
    if (!account.hasAccess) {
      setScreen("membership");
      return;
    }
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
    options: ResumeOptions = {},
  ) {
    const {
      allowedIds,
      orderedIds,
      continueFromFirstUnanswered = false,
    } = options;
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
    const validIds = (orderedIds ?? saved.questionIds).filter(
      (id) => Boolean(questionFor(module, id)) && (!allowedIds || allowedIds.has(id)),
    );
    if (!validIds.length) return false;
    const currentIndex = validIds.indexOf(currentSourceId);
    const firstUnanswered = continueFromFirstUnanswered
      ? validIds.findIndex((id) => !saved.submitted[id])
      : -1;
    const current =
      firstUnanswered >= 0
        ? firstUnanswered
        : currentIndex >= 0
          ? currentIndex
          : Math.min(saved.current, validIds.length - 1);
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
    resumeSession("graphic", "normal", {
      orderedIds: orderedGraphicQuestions.map((question) => question.sourceId),
      continueFromFirstUnanswered: true,
    });
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

  function resumeLastPractice() {
    if (!lastSavedPractice) return;
    if (
      activeSession?.context === "normal" &&
      activeSession.module === lastSavedPractice.module
    ) {
      practiceTimerEnabledRef.current = false;
      setPracticeQuestionReady(false);
      preloadPracticeQueue(activeSession, activeSession.current);
      goTo("practice");
      return;
    }
    if (lastSavedPractice.module === "graphic") {
      resumePractice();
    } else if (lastSavedPractice.module === "material") {
      startMaterialPractice(false);
    } else {
      resumeVerbalPractice();
    }
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
    void account.saveQuestionProgress(activeId, choice, isCorrect);
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
    const wrongIds = new Set(combinedPerformance[module].wrongIds);
    if (!wrongIds.size) return;
    if (resumeSession(module, "wrong", { allowedIds: wrongIds })) return;
    const pool = bankFor(module).filter((question) => wrongIds.has(question.sourceId));
    startSession(module, pool, "wrong");
  }

  function toggleFavorite(module: ModuleKey, sourceId: string) {
    const isFavorite = visibleFavorites[module].includes(sourceId);
    setFavorites((current) => {
      const ids = new Set(current[module]);
      if (isFavorite) ids.delete(sourceId);
      else ids.add(sourceId);
      return { ...current, [module]: [...ids] };
    });
    if (account.session) {
      void account.setQuestionFavorite(sourceId, !isFavorite);
    }
  }

  function startFavoritePractice(module: ModuleKey) {
    const favoriteIds = new Set(visibleFavorites[module]);
    if (!favoriteIds.size) return;
    if (resumeSession(module, "favorite", { allowedIds: favoriteIds })) return;
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
      combinedPerformance[wrongModule].wrongIds
        .map((id) => questionFor(wrongModule, id))
        .filter((question): question is BankQuestion => Boolean(question)),
    [combinedPerformance, wrongModule],
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
        <section className="page-heading bank-page-heading">
          <button className="back-link" type="button" onClick={goHome}>← 返回首页</button>
          <h1>选择题型</h1>
        </section>
        <section className="bank-layout">
          <button
            className="bank-resume-strip"
            type="button"
            onClick={resumeLastPractice}
            disabled={!lastSavedPractice}
          >
            <span>上次做题进度</span>
            <strong>
              {lastSavedPractice
                ? `已完成 ${Object.keys(lastSavedPractice.submitted ?? {}).length} 题，继续 →`
                : "暂无进度"}
            </strong>
          </button>
          <div className="bank-type-grid">
            <button className="bank-type-card" type="button" onClick={() => goTo("graphic-mode")}>
              <img src="/offer-assets/bank-graphic.svg" alt="" />
              <span className="bank-card-copy">
                <h2>图形推理</h2>
                <strong>进入题库 →</strong>
              </span>
            </button>
            <button className="bank-type-card" type="button" onClick={() => startMaterialPractice(false)}>
              <img src="/offer-assets/bank-material.svg" alt="" />
              <span className="bank-card-copy">
                <h2>材料分析</h2>
                <strong>进入题库 →</strong>
              </span>
            </button>
            <button className="bank-type-card" type="button" onClick={() => goTo("verbal-mode")}>
              <img src="/offer-assets/bank-verbal.svg" alt="" />
              <span className="bank-card-copy">
                <h2>文字推理</h2>
                <strong>进入题库 →</strong>
              </span>
            </button>
          </div>
          <button className="bank-wrong-card" type="button" onClick={() => goTo("wrong-categories")}>
            <span className="bank-wrong-art" aria-hidden="true">
              <span>错题本</span>
              <img src="/offer-assets/bank-wrong-deer.svg" alt="" />
            </span>
            <span className="bank-card-copy">
              <h2>错题集</h2>
              <strong>进入错题集 →</strong>
            </span>
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
          {savedGraphic && (
            <button className="resume-mode" type="button" onClick={resumePractice}>
              继续上次刷题 · 已完成 {Object.keys(savedGraphic.submitted ?? {}).length} 题 →
            </button>
          )}
        </section>
        <section className="mode-grid">
          <button
            className="mode-card featured-mode"
            type="button"
            onClick={() => startPractice(orderedGraphicQuestions)}
          >
            <span className="mode-number">01</span>
            <h2>顺序刷题</h2>
            <strong>从第一题开始核对 →</strong>
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
      <main className="inner-page overview-page categories-page wrong-categories-page has-bottom-nav">
        <SiteNav onHome={goHome} onPractice={() => goTo("categories")} />
        <section className="page-heading bank-page-heading">
          <button className="back-link" type="button" onClick={goHome}>← 返回首页</button>
          <h1>选择错题分类</h1>
        </section>
        <section className="bank-layout wrong-bank-layout">
          <div className="wrong-bank-list">
          {(["graphic", "material", "verbal"] as ModuleKey[]).map((module) => (
            <button
              className="bank-type-card wrong-bank-type-card"
              type="button"
              key={module}
              onClick={() => openWrongDashboard(module)}
            >
              <img
                src={`/offer-assets/bank-${module === "verbal" ? "verbal" : module}.svg`}
                alt=""
              />
              <span className="bank-card-copy">
                <h2>{moduleNames[module]}</h2>
                <small>
                  累计作答 {combinedPerformance[module].attempts} 次，当前错题 {combinedPerformance[module].wrongIds.length} 道
                </small>
                <strong>查看评估与错题 →</strong>
              </span>
            </button>
          ))}
          </div>
        </section>
        <BottomNav current="bank" onHome={goHome} onPractice={() => goTo("categories")} onMock={() => goTo("mock")} onProfile={() => goTo("profile")} />
      </main>
    );
  }

  if (screen === "favorite-categories") {
    return (
      <main className="inner-page overview-page categories-page favorite-categories-page has-bottom-nav">
        <SiteNav onHome={goHome} onPractice={() => goTo("categories")} />
        <section className="page-heading bank-page-heading">
          <button className="back-link" type="button" onClick={goHome}>← 返回首页</button>
          <h1>我的收藏夹</h1>
        </section>
        <section className="bank-layout favorite-bank-layout">
          <div className="wrong-bank-list">
          {(["graphic", "material", "verbal"] as ModuleKey[]).map((module) => (
            <button
              className="bank-type-card wrong-bank-type-card favorite-category-card"
              type="button"
              key={module}
              disabled={!visibleFavorites[module].length}
              onClick={() => startFavoritePractice(module)}
            >
              <img
                src={`/offer-assets/bank-${module === "verbal" ? "verbal" : module}.svg`}
                alt=""
              />
              <span className="bank-card-copy">
                <h2>{moduleNames[module]}</h2>
                <small>当前收藏 {visibleFavorites[module].length} 道，答对后仍会保留，可反复训练</small>
                <strong>
                  {visibleFavorites[module].length ? "进入收藏题练习 →" : "暂时没有收藏"}
                </strong>
              </span>
            </button>
          ))}
          </div>
        </section>
        <BottomNav current="profile" onHome={goHome} onPractice={() => goTo("categories")} onMock={() => goTo("mock")} onProfile={() => goTo("profile")} />
      </main>
    );
  }

  if (screen === "wrong-dashboard") {
    const stats = combinedPerformance[wrongModule];
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

  if (screen === "membership") {
    return <RestrictedPage onBack={() => goTo("home")} />;
  }

  if (screen === "profile") {
    const cloudAttempts = account.questionProgress.reduce(
      (sum, item) => sum + item.attempts,
      0,
    );
    const cloudCorrect = account.questionProgress.reduce(
      (sum, item) => sum + item.correct_attempts,
      0,
    );
    const cloudRecordedAttempts =
      cloudAttempts + account.completedExamQuestionCount;
    const cloudRecordedCorrect =
      cloudCorrect + account.completedExamCorrectCount;
    const cloudAccuracy = cloudRecordedAttempts
      ? Math.round((cloudRecordedCorrect / cloudRecordedAttempts) * 100)
      : 0;
    const accuracy = totalAttempts
      ? Math.round((totalCorrect / totalAttempts) * 100)
      : cloudAccuracy;
    const profileAttempts = account.session
      ? Math.max(cloudRecordedAttempts, totalAttempts)
      : totalAttempts;
    const answeredQuestionIds = new Set(
      Object.values(savedSessions).flatMap((saved) =>
        Object.keys(saved.submitted),
      ),
    );
    account.questionProgress.forEach((item) =>
      answeredQuestionIds.add(item.question_id),
    );
    account.completedExamQuestionIds.forEach((id) =>
      answeredQuestionIds.add(id),
    );
    if (activeSession) {
      Object.keys(activeSession.submitted).forEach((id) =>
        answeredQuestionIds.add(id),
      );
    }
    const practicedQuestionCount = account.session
      ? answeredQuestionIds.size
      : currentSessionAnswered;
    const memberIsCurrent =
      Boolean(account.profile?.is_member) &&
      (!account.profile?.membership_expiry ||
        Date.parse(account.profile.membership_expiry) > profileReferenceTime);
    const sessionFullName =
      typeof account.session?.user.user_metadata?.full_name === "string"
        ? account.session.user.user_metadata.full_name.trim()
        : "";
    const profileName =
      account.profile?.full_name?.trim() ||
      sessionFullName ||
      account.profile?.email?.split("@")[0] ||
      account.session?.user.email?.split("@")[0] ||
      (account.session ? "用户" : "游客");
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
            <div
              className={`profile-avatar ${account.session ? "" : "guest-avatar"}`}
              aria-label={account.session ? "用户头像" : "游客头像"}
            >
              <img src="/offer-assets/profile-avatar.svg" alt="" />
            </div>
            <div>
              <span>我的学习档案</span>
              <h1>{profileName}</h1>
              <p>
                {account.session
                  ? memberIsCurrent
                    ? "会员有效"
                    : "会员未开通"
                  : "登录后保存学习数据"}
                {"　"}
                <em>
                  {account.session ? "同账号进度自动同步" : "游客模式"}
                </em>
              </p>
              {account.profile?.is_member && (
                <small>
                  订阅时间：
                  {formatMembershipDate(account.profile.membership_started_at)}
                  {" 至 "}
                  {formatMembershipDate(account.profile.membership_expiry)}
                </small>
              )}
            </div>
            <div className="profile-account-actions">
              {account.session ? (
                <>
                  <button type="button" onClick={openProfileEditor}>
                    编辑资料
                  </button>
                  <button
                    className="profile-membership"
                    type="button"
                    onClick={() => goTo("membership")}
                  >
                    {memberIsCurrent ? "我的会员账户" : "开通会员"}
                  </button>
                  <button
                    className="profile-signout"
                    type="button"
                    onClick={() => void account.signOut()}
                  >
                    退出登录
                  </button>
                </>
              ) : (
                <button
                  className="profile-login"
                  type="button"
                  onClick={account.openAuth}
                >
                  登录 / 注册
                </button>
              )}
            </div>
          </article>
          <section className="profile-stats" aria-label="刷题数据">
            <article><span>累计做题</span><strong>{profileAttempts}</strong></article>
            <article><span>已练题目</span><strong>{practicedQuestionCount}</strong></article>
            <article><span>正确率</span><strong>{accuracy}%</strong></article>
            <article><span>完成套数</span><strong>{account.session ? account.completedExamCount : 0}</strong></article>
          </section>
          <div className="profile-columns">
            <section className="profile-panel learning-links">
              <div className="section-line"><span>学习记录</span><small>自动保存</small></div>
              <button type="button" onClick={() => goTo("wrong-categories")}><b><img src="/offer-assets/profile-wrong.svg" alt="" /></b><span>错题集<small>集中复盘薄弱题</small></span><em>›</em></button>
              <button type="button" onClick={() => goTo("favorite-categories")}><b><img src="/offer-assets/profile-favorite.svg" alt="" /></b><span>收藏夹<small>反复训练犹豫题</small></span><em>›</em></button>
              <button type="button" onClick={() => goTo("mock")}><b><img src="/offer-assets/profile-mock.svg" alt="" /></b><span>模考记录<small>回看限时考试表现</small></span><em>›</em></button>
            </section>
            <section className="profile-panel progress-panel">
              <div className="section-line profile-progress-heading">
                <span>北森备考进度</span>
                <img src="/offer-assets/profile-progress-deer.svg" alt="" />
                <small>按作答次数估算</small>
              </div>
              {progressItems.map((item) => {
                const percent = Math.min(100, Math.round((combinedPerformance[item.module].attempts / item.total) * 100));
                return <div className="profile-progress" key={item.module}><p><span>{item.label}</span><strong>{percent}%</strong></p><i><b style={{ width: `${percent}%` }} /></i></div>;
              })}
            </section>
          </div>
        </section>
        {profileEditing && (
          <div
            className="auth-overlay"
            role="presentation"
            onMouseDown={() => setProfileEditing(false)}
          >
            <section
              className="auth-dialog profile-edit-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="编辑个人资料"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button
                className="auth-close"
                type="button"
                onClick={() => setProfileEditing(false)}
              >
                ×
              </button>
              <span className="auth-kicker">PROFILE</span>
              <h2>编辑个人资料</h2>
              <p>姓名或昵称会显示在“我的”页面。</p>
              <label className="auth-field">
                <span>姓名 / 昵称</span>
                <input
                  value={profileNameDraft}
                  maxLength={30}
                  autoFocus
                  placeholder="请输入姓名或昵称"
                  onChange={(event) => setProfileNameDraft(event.target.value)}
                />
              </label>
              <button
                className="auth-primary"
                type="button"
                disabled={profileSaving || !profileNameDraft.trim()}
                onClick={() => void saveProfileName()}
              >
                {profileSaving ? "保存中…" : "保存"}
              </button>
              {profileEditError && (
                <p className="auth-error">{profileEditError}</p>
              )}
            </section>
          </div>
        )}
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
        favorites={visibleFavorites}
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
    const isFavorite = visibleFavorites[activeSession.module].includes(activeId);
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
            <span>
              {activeSession.module === "graphic"
                ? (activeQuestion as GraphicQuestion).displayId ?? activeQuestion.sourceId
                : activeQuestion.sourceId}
            </span>
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
                {(activeQuestion as GraphicQuestion).prompt && (
                  <p className="graphic-question-prompt">
                    {(activeQuestion as GraphicQuestion).prompt}
                  </p>
                )}
                {((activeQuestion as GraphicQuestion).stemImages?.length ||
                  (activeQuestion as GraphicQuestion).image) && (
                  <div
                    className={`source-image-wrap stem-image-wrap ${((activeQuestion as GraphicQuestion).stemImages?.length ?? 0) > 1 ? "multi-stem-image-wrap" : ""}`}
                  >
                    {(
                      (activeQuestion as GraphicQuestion).stemImages?.length
                        ? (activeQuestion as GraphicQuestion).stemImages!
                        : [(activeQuestion as GraphicQuestion).image]
                    ).map((image, index) => (
                      <img
                        key={image}
                        src={image}
                        alt={`${(activeQuestion as GraphicQuestion).displayId ?? activeId} 图形推理题图 ${index + 1}`}
                        draggable={false}
                      />
                    ))}
                  </div>
                )}
                {(activeQuestion as GraphicQuestion).optionImages.length === optionCount ? (
                  <div className="source-options" data-option-count={optionCount} aria-label="请选择答案">
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
      <SiteNav
        onHome={goHome}
        onPractice={() => goTo("categories")}
      />
      <section className="hero">
        <article className="hero-banner">
          <div className="hero-copy">
            <span className="hero-label">OFFER FAWN</span>
            <span className="visually-hidden">
              专注大厂行测备考：进入分类刷题、进入模考、错题集、看看题库结构
            </span>
            <h1>Offer鹿，<br /><span>一路录取</span></h1>
          </div>
          <div className="home-hero-mascot" aria-hidden="true">
            <img src="/offer-assets/hero-scene.svg" alt="" />
          </div>
        </article>
        <div className="hero-actions">
          <button className="hero-action hero-action-primary" type="button" onClick={() => goTo("categories")}>
            <img src="/offer-assets/feature-practice.svg" alt="" /><strong>分类刷题</strong>
          </button>
          <button className="hero-action hero-action-mock" type="button" onClick={() => goTo("mock")}>
            <img src="/offer-assets/feature-mock.svg" alt="" /><strong>模拟考试</strong>
          </button>
          <button className="hero-action hero-action-wrong" type="button" onClick={() => goTo("wrong-categories")}>
            <img src="/offer-assets/feature-wrong.svg" alt="" /><strong>错题回顾</strong>
          </button>
          <button className="hero-action hero-action-favorite" type="button" onClick={() => goTo("favorite-categories")}>
            <img src="/offer-assets/feature-favorite.svg" alt="" /><strong>收藏夹</strong>
          </button>
        </div>
      </section>

      <section className="structure-section" id="structure">
        <div className="section-title-row"><div><h2>选择题库类型</h2></div><button type="button" onClick={() => goTo("categories")}>开始练习</button></div>
        <div className="home-category-tags">
          <button type="button" onClick={() => goTo("graphic-mode")}><img src="/offer-assets/module-graphic.svg" alt="" /><span><strong>图形推理</strong><small>{questions.length} 题</small></span></button>
          <button type="button" onClick={() => startMaterialPractice(false)}><img src="/offer-assets/module-material.svg" alt="" /><span><strong>材料分析</strong><small>{materialQuestions.length} 题</small></span></button>
          <button type="button" onClick={() => goTo("verbal-mode")}><img src="/offer-assets/module-verbal.svg" alt="" /><span><strong>文字推理</strong><small>{verbalQuestions.length} 题</small></span></button>
        </div>
        <div className="trust-title"><h2>每一步，都留下学习轨迹</h2></div>
        <section className="trust-panel">
          <div><img src="/offer-assets/benefit-targeted.svg" alt="" /><strong>定向刷题</strong></div>
          <div><img src="/offer-assets/benefit-timer.svg" alt="" /><strong>真实计时</strong></div>
          <div><img src="/offer-assets/benefit-archive.svg" alt="" /><strong>错题归档</strong></div>
          <div><img src="/offer-assets/benefit-update.svg" alt="" /><strong>持续更新</strong></div>
        </section>
      </section>
      <BottomNav current="home" onHome={goHome} onPractice={() => goTo("categories")} onMock={() => goTo("mock")} onProfile={() => goTo("profile")} />
    </main>
  );
}
