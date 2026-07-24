"use client";

import { useEffect, useMemo, useState } from "react";

type Point = "位置规律" | "样式规律" | "属性规律" | "数量规律" | "特殊规律";
type Difficulty = "入门" | "提高" | "强化";
type Screen = "home" | "mode" | "practice" | "result";
type Question = {
  id: number;
  sourceId: string;
  point: Point;
  difficulty: Difficulty;
  finePoints: string[];
  instruction: string;
  stemArt?: string;
  optionArts: string[];
  answer: number;
  analysis: string;
  method: string;
};

const questions: Question[] = [
  {
    id: 1,
    sourceId: "1-1",
    point: "位置规律",
    difficulty: "提高",
    finePoints: ["多元素移动", "方向变化", "线条数量交替"],
    instruction: "问号处的图形应该是：",
    stemArt: "q1-stem",
    optionArts: ["q1-a", "q1-b", "q1-c", "q1-d"],
    answer: 3,
    method: "复杂线条不要整体硬转。先拆出多线端、折角端和短支线，分别追踪数量与位置。",
    analysis:
      "将图形拆成“多线端、折角端、短支线”三部分。多线端的数量按 3、2、3、2 交替，所以下一图应先恢复为 3 条平行线；再追踪各部分的移动与转向，三线端应落在左下，折角端位于右上，短支线处在主干上方。只有 D 同时满足。",
  },
  {
    id: 2,
    sourceId: "1-2",
    point: "位置规律",
    difficulty: "强化",
    finePoints: ["矩阵位置", "线型遍历", "黑点落区"],
    instruction: "空白处的图形应该是：",
    stemArt: "q2-stem",
    optionArts: ["q2-a", "q2-b", "q2-c", "q2-d"],
    answer: 1,
    method: "先忽略黑点，只排线型；线型唯一后，再用黑点相对线条的位置做二次校验。",
    analysis:
      "把大图还原成 4×4 方格。第一行线型依次为横线、下降斜线、竖线、上升斜线；每向下一行，整组线型左移一格。因此三个空格的线型应依次为上升斜线、横线、横线。再按行列核对黑点所在区域：斜线格的点应在线的上方，右侧横线格与下方横线格的点位也要与相邻行列衔接。只有 B 的线型和三个点位全部吻合。",
  },
  {
    id: 3,
    sourceId: "1-3",
    point: "数量规律",
    difficulty: "入门",
    finePoints: ["边数关系", "内外图形", "大小比较"],
    instruction: "下列哪一个图形是特殊的？",
    optionArts: ["q3-a", "q3-b", "q3-c", "q3-d"],
    answer: 0,
    method: "外方框四项都有，可先视为无效信息；只比较中层多边形与最内层图形的边数。",
    analysis:
      "忽略每项相同的外方框。B、C、D 中，最内层图形的边数都少于包住它的中层多边形：3＜4、4＜6、3＜5；只有 A 中内层正方形为 4 条边，反而多于中层三角形的 3 条边，因此 A 是特殊项。",
  },
  {
    id: 4,
    sourceId: "1-4",
    point: "样式规律",
    difficulty: "提高",
    finePoints: ["图形运算", "去同存异", "共有轮廓消除"],
    instruction: "观察左侧三图的关系，选择问号处应填入的图形。",
    stemArt: "q4-stem",
    optionArts: ["q4-a", "q4-b", "q4-c", "q4-d"],
    answer: 3,
    method: "看到两图外框相同、内部线条不同，优先尝试去同存异，并逐段核对哪些轮廓被消除。",
    analysis:
      "左侧关系是：后两幅图去同存异得到第一幅图。两图共有的外五边形被消去，不同的内部线条被保留，正好组成五角星。右侧沿用同一运算，共有的六边形外框及重合线段应被消去，最后只剩独立的灰色四边形，对应 D。",
  },
  {
    id: 5,
    sourceId: "1-5",
    point: "样式规律",
    difficulty: "提高",
    finePoints: ["黑白运算", "对应位置", "相同为灰·不同为白"],
    instruction: "从四个选项中选择最合适的一项填入问号处。",
    stemArt: "q5-stem",
    optionArts: ["q5-a", "q5-b", "q5-c", "q5-d"],
    answer: 1,
    method: "把大三角拆成 9 个固定小三角，逐格做黑白运算，不要凭整体灰色面积判断。",
    analysis:
      "每行前两图按对应小三角做黑白运算：颜色相同的位置变为灰色，颜色不同的位置变为白色。前两行都能完整验证这一规则。第三行中，顶端小三角颜色不同，结果为白；中间 3 个小三角颜色相同，结果为灰；底边 5 个小三角颜色均不同，结果全部为白。符合的是 B。",
  },
];

const pointOrder: Point[] = ["位置规律", "样式规律", "属性规律", "数量规律", "特殊规律"];
const letters = ["A", "B", "C", "D"];

type LineKind = "h" | "v" | "up" | "down";

function CellGlyph({
  x,
  y,
  size,
  kind,
  dot,
}: {
  x: number;
  y: number;
  size: number;
  kind: LineKind;
  dot: [number, number];
}) {
  const inset = 2;
  const line =
    kind === "h" ? (
      <line x1={x} y1={y + size / 2} x2={x + size} y2={y + size / 2} />
    ) : kind === "v" ? (
      <line x1={x + size / 2} y1={y} x2={x + size / 2} y2={y + size} />
    ) : kind === "up" ? (
      <line x1={x + inset} y1={y + size - inset} x2={x + size - inset} y2={y + inset} />
    ) : (
      <line x1={x + inset} y1={y + inset} x2={x + size - inset} y2={y + size - inset} />
    );

  return (
    <g className="matrix-glyph">
      {line}
      <circle cx={x + dot[0] * size} cy={y + dot[1] * size} r={size * 0.095} />
    </g>
  );
}

function Q2Option({ variant }: { variant: "a" | "b" | "c" | "d" }) {
  const size = 48;
  const topKind: LineKind = variant === "d" ? "down" : "up";
  const topDots: [number, number][] =
    variant === "c"
      ? [
          [0.68, 0.18],
          [0.86, 0.18],
        ]
      : variant === "a"
        ? [[0.25, 0.75]]
        : variant === "d"
          ? [[0.82, 0.72]]
          : [[0.64, 0.16]];

  return (
    <svg className="vector-art option-vector" viewBox="0 0 118 118" role="img" aria-hidden="true">
      <g className="art-stroke">
        <path d={`M11 11H${11 + size * 2}V${11 + size}H${11 + size}V${11 + size * 2}H11Z`} />
        {topKind === "up" ? (
          <line x1="13" y1={11 + size - 2} x2={11 + size - 2} y2="13" />
        ) : (
          <line x1="13" y1="13" x2={11 + size - 2} y2={11 + size - 2} />
        )}
        <line x1={11 + size} y1={11 + size / 2} x2={11 + size * 2} y2={11 + size / 2} />
        <line x1="11" y1={11 + size * 1.5} x2={11 + size} y2={11 + size * 1.5} />
      </g>
      {topDots.map(([dx, dy], index) => (
        <circle key={index} cx={11 + dx * size} cy={11 + dy * size} r="4.7" fill="currentColor" />
      ))}
      {variant !== "c" && <circle cx={11 + size * 1.82} cy={11 + size * 0.62} r="4.7" fill="currentColor" />}
      <circle
        cx={11 + size * (variant === "d" ? 0.78 : 0.58)}
        cy={11 + size * (variant === "d" ? 1.78 : 1.32)}
        r="4.7"
        fill="currentColor"
      />
    </svg>
  );
}

const trianglePoints = [
  "50,5 35,31.7 65,31.7",
  "35,31.7 20,58.3 50,58.3",
  "35,31.7 65,31.7 50,58.3",
  "65,31.7 50,58.3 80,58.3",
  "20,58.3 5,85 35,85",
  "20,58.3 50,58.3 35,85",
  "50,58.3 35,85 65,85",
  "50,58.3 80,58.3 65,85",
  "80,58.3 65,85 95,85",
];

function TriangleTile({
  gray,
  x = 0,
  y = 0,
  scale = 1,
  frame = false,
}: {
  gray: number[];
  x?: number;
  y?: number;
  scale?: number;
  frame?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {frame && <rect x="-3" y="-3" width="106" height="96" rx="2" className="tile-frame" />}
      {trianglePoints.map((points, index) => (
        <polygon
          key={points}
          points={points}
          className={gray.includes(index) ? "tile-gray" : "tile-white"}
        />
      ))}
      <polygon points="50,5 5,85 95,85" className="tile-outline" />
    </g>
  );
}

const q5Patterns = {
  r1c1: [0, 2, 3, 4, 5, 7],
  r1c2: [0, 3, 5, 6, 7],
  r1c3: [0, 1, 3, 5, 7, 8],
  r2c1: [2, 3, 4, 6, 8],
  r2c2: [0, 3, 4, 5, 6, 7],
  r2c3: [1, 3, 4, 6],
  r3c1: [1, 2, 3, 4],
  r3c2: [0, 1, 2, 3, 5, 6, 7, 8],
  a: [2, 4, 5, 6, 7, 8],
  b: [1, 2, 3],
  c: [0, 4, 5, 6, 7, 8],
  d: [0, 5, 8],
};

function QuestionArt({ name }: { name: string }) {
  if (name === "q1-stem") {
    return (
      <svg className="vector-art stem-vector q1-vector" viewBox="0 0 520 130" role="img" aria-label="线条图形序列">
        <g className="panel-grid">
          {[0, 1, 2, 3, 4].map((index) => (
            <rect key={index} x={index * 104 + 1} y="1" width="103" height="128" />
          ))}
        </g>
        <g className="art-stroke" strokeLinecap="round" strokeLinejoin="round">
          <path d="M53 105V27H72V42 M53 65H37" />
          <path d="M37 105H69 M40 110H66 M43 115H63" />

          <path d="M181 102L137 58L150 45L139 34 M158 79L149 88" />
          <path d="M175 106L187 94 M179 110L191 98" />

          <path d="M232 31L289 88L279 100 M260 59L269 50" />
          <path d="M222 39L234 27 M226 43L238 31 M230 47L242 35" />

          <path d="M402 32L356 100L339 83 M376 69L386 77" />
          <path d="M397 27L407 37 M401 23L411 33" />
        </g>
        <text x="468" y="87" className="question-glyph">
          ?
        </text>
      </svg>
    );
  }

  if (name.startsWith("q1-")) {
    const option = name.at(-1);
    return (
      <svg className="vector-art option-vector" viewBox="0 0 120 120" role="img" aria-hidden="true">
        <g className="art-stroke" strokeLinecap="round" strokeLinejoin="round">
          {option === "a" && (
            <>
              <path d="M27 87L78 36L92 50 M53 61L62 70" />
              <path d="M22 82L32 92 M26 78L36 88" />
            </>
          )}
          {option === "b" && (
            <>
              <path d="M21 72V55H91 M53 55V42" />
              <path d="M88 44V66 M94 44V66 M100 44V66" />
            </>
          )}
          {option === "c" && (
            <>
              <path d="M56 24V92H73V77 M56 62H43" />
              <path d="M42 24H70 M45 18H67 M48 12H64" />
            </>
          )}
          {option === "d" && (
            <>
              <path d="M27 88L78 37L92 51 M53 62L62 71" />
              <path d="M20 82L33 95 M24 78L37 91 M28 74L41 87" />
            </>
          )}
        </g>
      </svg>
    );
  }

  if (name === "q2-stem") {
    const cells: Array<[number, number, LineKind, [number, number]]> = [
      [0, 0, "h", [0.24, 0.34]],
      [1, 0, "down", [0.2, 0.28]],
      [2, 0, "v", [0.22, 0.22]],
      [3, 0, "up", [0.72, 0.18]],
      [0, 1, "down", [0.17, 0.24]],
      [1, 1, "v", [0.34, 0.28]],
      [2, 1, "up", [0.76, 0.16]],
      [3, 1, "h", [0.82, 0.7]],
      [0, 2, "v", [0.62, 0.18]],
      [3, 2, "down", [0.8, 0.76]],
      [0, 3, "up", [0.68, 0.18]],
      [2, 3, "down", [0.78, 0.76]],
      [3, 3, "v", [0.25, 0.72]],
    ];
    return (
      <svg className="vector-art stem-vector q2-vector" viewBox="0 0 284 284" role="img" aria-label="四乘四图形矩阵">
        <g className="art-stroke matrix-grid">
          <rect x="2" y="2" width="280" height="280" />
          {[1, 2, 3].map((index) => (
            <g key={index}>
              <line x1={2 + index * 70} y1="2" x2={2 + index * 70} y2="282" />
              <line x1="2" y1={2 + index * 70} x2="282" y2={2 + index * 70} />
            </g>
          ))}
          {cells.map(([column, row, kind, dot]) => (
            <CellGlyph key={`${column}-${row}`} x={2 + column * 70} y={2 + row * 70} size={70} kind={kind} dot={dot} />
          ))}
        </g>
        <path d="M72 142H212V212H142V282H72Z" className="matrix-blank" />
        <path d="M72 142H212V212H142V282H72Z" className="matrix-blank-outline" />
      </svg>
    );
  }

  if (name.startsWith("q2-")) {
    return <Q2Option variant={name.at(-1) as "a" | "b" | "c" | "d"} />;
  }

  if (name.startsWith("q3-")) {
    const option = name.at(-1);
    return (
      <svg className="vector-art option-vector" viewBox="0 0 120 120" role="img" aria-hidden="true">
        <rect x="8" y="8" width="104" height="104" className="choice-frame" />
        {option === "a" && (
          <>
            <polygon points="60,22 27,88 93,88" className="art-stroke shape-white" />
            <rect x="47" y="61" width="26" height="27" className="art-stroke shape-white" />
          </>
        )}
        {option === "b" && (
          <>
            <rect x="30" y="30" width="60" height="60" className="art-stroke shape-white" />
            <polygon points="60,43 43,78 77,78" className="shape-dark" />
          </>
        )}
        {option === "c" && (
          <>
            <polygon points="60,22 90,39 90,75 60,93 30,75 30,39" className="art-stroke shape-white" />
            <rect x="44" y="44" width="32" height="32" className="shape-gray art-stroke" />
          </>
        )}
        {option === "d" && (
          <>
            <polygon points="60,21 91,45 79,85 41,85 29,45" className="art-stroke shape-white" />
            <polygon points="60,43 43,78 77,78" className="shape-dark" />
          </>
        )}
      </svg>
    );
  }

  if (name === "q4-stem") {
    return (
      <svg className="vector-art stem-vector q4-vector" viewBox="0 0 820 170" role="img" aria-label="图形运算类比">
        <g className="art-stroke" strokeLinejoin="round">
          <polygon points="73,19 87,61 132,61 96,87 110,130 73,104 37,130 50,87 14,61 59,61" />
          <polygon points="210,18 262,56 242,119 178,119 158,56" />
          <path d="M210 18L178 119L262 56 M158 56L242 119" />
          <polygon points="351,18 403,56 383,119 319,119 299,56" />
          <path d="M351 18L383 119L299 56 M403 56L319 119" />
        </g>
        <text x="432" y="91" className="relation-glyph">
          →
        </text>
        <g className="art-stroke" strokeLinejoin="round">
          <polygon points="522,18 567,43 567,95 522,120 477,95 477,43" />
          <path d="M522 18L493 104 M522 18L557 101 M477 43L567 95" />
          <polygon points="492,104 542,29 568,74 527,112" className="shape-gray" />

          <polygon points="658,18 703,43 703,95 658,120 613,95 613,43" />
          <path d="M658 18L629 104 M658 18L693 101 M613 43L703 95" />
          <polygon points="629,20 675,20 644,105 614,85" className="shape-gray" />
        </g>
        <text x="767" y="101" className="question-glyph">
          ?
        </text>
      </svg>
    );
  }

  if (name.startsWith("q4-")) {
    const option = name.at(-1);
    return (
      <svg className="vector-art option-vector" viewBox="0 0 120 120" role="img" aria-hidden="true">
        {option === "a" && <polygon points="60,17 96,38 96,80 60,101 24,80 24,38" className="art-stroke shape-white" />}
        {option === "b" && (
          <>
            <polygon points="60,17 96,38 96,80 60,101 24,80 24,38" className="art-stroke shape-white" />
            <path d="M60 17L30 80 M60 17L90 88 M24 38L96 80" className="art-stroke shape-white" />
            <polygon points="52,24 92,54 80,91 48,72" className="shape-gray art-stroke" />
          </>
        )}
        {option === "c" && (
          <>
            <polygon points="60,17 96,38 96,80 60,101 24,80 24,38" className="art-stroke shape-white" />
            <polygon points="43,20 82,20 96,68 57,93 30,75" className="shape-gray art-stroke" />
          </>
        )}
        {option === "d" && <polygon points="37,20 78,20 94,68 35,101" className="shape-gray art-stroke" />}
      </svg>
    );
  }

  if (name === "q5-stem") {
    const tiles: Array<[number, number, number[]]> = [
      [0, 0, q5Patterns.r1c1],
      [1, 0, q5Patterns.r1c2],
      [2, 0, q5Patterns.r1c3],
      [0, 1, q5Patterns.r2c1],
      [1, 1, q5Patterns.r2c2],
      [2, 1, q5Patterns.r2c3],
      [0, 2, q5Patterns.r3c1],
      [1, 2, q5Patterns.r3c2],
    ];
    return (
      <svg className="vector-art stem-vector q5-vector" viewBox="0 0 324 294" role="img" aria-label="三角形黑白运算矩阵">
        <g className="tile-grid">
          {[0, 1, 2].flatMap((row) =>
            [0, 1, 2].map((column) => (
              <rect key={`${row}-${column}`} x={column * 108 + 1} y={row * 98 + 1} width="107" height="97" />
            )),
          )}
        </g>
        {tiles.map(([column, row, gray]) => (
          <TriangleTile key={`${column}-${row}`} gray={gray} x={column * 108 + 5} y={row * 98 + 4} />
        ))}
        <text x="270" y="268" className="question-glyph">
          ?
        </text>
      </svg>
    );
  }

  if (name.startsWith("q5-")) {
    const pattern = q5Patterns[name.at(-1) as "a" | "b" | "c" | "d"];
    return (
      <svg className="vector-art option-vector" viewBox="0 0 120 110" role="img" aria-hidden="true">
        <TriangleTile gray={pattern} x={10} y={8} />
      </svg>
    );
  }

  return null;
}

function Logo() {
  return (
    <div className="logo" aria-label="秋招行测首页">
      <span className="logo-mark">Q</span>
      <span>秋招行测</span>
      <em>Beta</em>
    </div>
  );
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
    if (saved) setBestScore(Math.min(Number(saved), questions.length));
  }, []);

  useEffect(() => {
    if (screen !== "practice" || answered) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [screen, current, answered]);

  const counts = useMemo(
    () =>
      pointOrder
        .map((point) => ({
          point,
          count: questions.filter((question) => question.point === point).length,
        }))
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
      setCurrent((value) => value + 1);
      setElapsed(0);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const finalScore = session.reduce(
      (total, question, index) => total + (selections[index] === question.answer ? 1 : 0),
      0,
    );
    setScore(finalScore);
    if (session.length === questions.length && finalScore > bestScore) {
      setBestScore(finalScore);
      window.localStorage.setItem("qz-best-score", String(finalScore));
    }
    setScreen("result");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function exitPractice() {
    setScreen("home");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (screen === "practice" && activeQuestion) {
    return (
      <main className="practice-shell">
        <header className="practice-header">
          <button className="text-button" onClick={exitPractice} aria-label="退出练习">
            ← 退出
          </button>
          <div className="progress-copy">
            <span>图形推理 · 北森题库 1</span>
            <strong>
              {current + 1} / {session.length}
            </strong>
          </div>
          <div className={`timer ${answered ? "is-paused" : ""}`}>
            <span className="timer-dot" />
            <b>{elapsed}</b> 秒
          </div>
        </header>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${((current + 1) / session.length) * 100}%` }} />
        </div>

        <section className="question-wrap">
          <div className="question-meta">
            <span className="eyebrow">题库编号 {activeQuestion.sourceId}</span>
            <span className="category-pill">{activeQuestion.point}</span>
          </div>
          <h1>{activeQuestion.instruction}</h1>

          {activeQuestion.stemArt && (
            <div className="source-stem" aria-label="题干图形">
              <QuestionArt name={activeQuestion.stemArt} />
            </div>
          )}

          <div className="options-grid" aria-label="答案选项">
            {activeQuestion.optionArts.map((optionArt, index) => {
              const isCorrect = answered && index === activeQuestion.answer;
              const isWrong = answered && index === chosen && index !== activeQuestion.answer;
              const isSelected = !answered && index === chosen;
              return (
                <button
                  className={`option-card ${isSelected ? "is-selected" : ""} ${isCorrect ? "is-correct" : ""} ${isWrong ? "is-wrong" : ""}`}
                  key={optionArt}
                  onClick={() => choose(index)}
                  disabled={answered}
                  aria-label={`选项 ${letters[index]}`}
                >
                  <span className="option-letter">{letters[index]}</span>
                  <QuestionArt name={optionArt} />
                  {isCorrect && <span className="result-icon">✓</span>}
                  {isWrong && <span className="result-icon">×</span>}
                </button>
              );
            })}
          </div>

          {!answered && (
            <div className="submit-row">
              <p className="answer-hint">
                {hasSelection
                  ? `已选择 ${letters[chosen ?? 0]}，提交前仍可修改`
                  : "先选择一个选项，提交前不会显示答案"}
              </p>
              <button className="submit-button" onClick={submitAnswer} disabled={!hasSelection}>
                确认提交
              </button>
            </div>
          )}

          {answered && (
            <section className="analysis-card" aria-live="polite">
              <div className={`answer-banner ${chosen === activeQuestion.answer ? "right" : "wrong"}`}>
                <span>{chosen === activeQuestion.answer ? "回答正确" : "再想一步"}</span>
                <strong>正确答案 {letters[activeQuestion.answer]}</strong>
              </div>
              <div className="analysis-body">
                <div className="analysis-title">
                  <span>解析</span>
                  <div className="fine-points">
                    <em>{activeQuestion.difficulty}</em>
                    {activeQuestion.finePoints.map((point) => (
                      <em key={point}>{point}</em>
                    ))}
                  </div>
                </div>
                <p>{activeQuestion.analysis}</p>
                <div className="method-note">
                  <span>解题抓手</span>
                  <p>{activeQuestion.method}</p>
                </div>
                <button className="next-button" onClick={goNext}>
                  {current === session.length - 1 ? "查看本轮成绩" : "下一题"}
                  <span>→</span>
                </button>
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
        <nav className="site-nav">
          <Logo />
          <button className="nav-back" onClick={() => setScreen("home")}>
            返回首页
          </button>
        </nav>
        <section className="mode-heading">
          <span className="eyebrow">模块 01 · 图形推理</span>
          <h1>今天想怎么练？</h1>
          <p>每题独立计时；选项可修改，只有确认提交后才显示答案、考点与完整推导。</p>
        </section>
        <section className="mode-grid">
          <button className="mode-card random-card" onClick={startRandom}>
            <span className="mode-index">01</span>
            <div>
              <span className="mode-kicker">推荐</span>
              <h2>随机刷题</h2>
              <p>打乱本轮 5 道北森原题，像真正考试一样进入未知题序。</p>
            </div>
            <span className="mode-arrow">↗</span>
          </button>
          <div className="mode-card point-card">
            <span className="mode-index">02</span>
            <div className="point-card-copy">
              <span className="mode-kicker">专项突破</span>
              <h2>按照考点刷</h2>
              <p>先按大类集中训练，提交后再查看细颗粒考点。</p>
            </div>
            <div className="point-buttons">
              {counts.map(({ point, count }) => (
                <button
                  key={point}
                  onClick={() => startPractice(questions.filter((question) => question.point === point))}
                >
                  <span>{point}</span>
                  <b>{count} 题</b>
                  <em>→</em>
                </button>
              ))}
            </div>
          </div>
        </section>
        <p className="source-note">
          当前已录入题库 1 的前 5 道原题。题面只保留题干和选项，原 PDF 中的蓝色答案标记未进入作答区。
        </p>
      </main>
    );
  }

  if (screen === "result") {
    const percentage = Math.round((score / session.length) * 100);
    return (
      <main className="result-page">
        <nav className="site-nav">
          <Logo />
        </nav>
        <section className="result-card">
          <span className="eyebrow">本轮完成</span>
          <div
            className="score-ring"
            style={{ "--score": `${percentage * 3.6}deg` } as React.CSSProperties}
          >
            <div>
              <strong>{score}</strong>
              <span>/ {session.length}</span>
            </div>
          </div>
          <h1>{percentage >= 80 ? "状态很好，继续保持。" : "规律已经浮出来了。"}</h1>
          <p>
            本轮正确率 {percentage}%。
            {percentage < 80
              ? "建议回到专项训练，把错题对应的大类再练一遍。"
              : "可以试试打乱题序，再压缩单题用时。"}
          </p>
          <div className="result-actions">
            <button className="primary-button" onClick={startRandom}>
              再来一轮 <span>→</span>
            </button>
            <button className="secondary-button" onClick={() => setScreen("mode")}>
              选择专项
            </button>
          </div>
          <button className="home-link" onClick={exitPractice}>
            返回首页
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="home-page">
      <nav className="site-nav">
        <Logo />
        <div className="nav-links">
          <a href="#library">题库</a>
          <span className="disabled-link">
            模拟考 <em>即将上线</em>
          </span>
        </div>
        <button className="nav-cta" onClick={() => setScreen("mode")}>
          开始刷题 <span>↗</span>
        </button>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <span className="hero-label">FOR 2026 AUTUMN RECRUITMENT</span>
          <h1>
            大厂行测，
            <br />
            终于有地方<span>练了。</span>
          </h1>
          <p>
            为秋招学生做的行测刷题站。先从图形推理开始，
            <br className="desktop-break" />
            不套用考公节奏，只练大厂笔试真正会遇到的思路。
          </p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => setScreen("mode")}>
              进入图形推理 <span>→</span>
            </button>
            <a href="#library">看看题库结构</a>
          </div>
        </div>
        <div className="hero-board" aria-label="站点当前数据">
          <div className="board-top">
            <span>今日训练台</span>
            <em>原题试录</em>
          </div>
          <div className="board-score">
            <div>
              <span>已收录</span>
              <strong>{questions.length}</strong>
              <small>道北森原题</small>
            </div>
            <div className="mini-chart" aria-hidden="true">
              {[28, 44, 34, 68, 54, 86, 74].map((height, index) => (
                <span key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
          <div className="board-progress">
            <div>
              <span>你的历史最佳</span>
              <strong>
                {bestScore} / {questions.length}
              </strong>
            </div>
            <div className="thin-track">
              <span style={{ width: `${(bestScore / questions.length) * 100}%` }} />
            </div>
          </div>
          <div className="board-footer">
            <span>逐题计时</span>
            <span>提交后判题</span>
            <span>拆解考点</span>
          </div>
        </div>
      </section>

      <section className="manifesto-strip">
        <span>不是课程堆砌</span>
        <i>•</i>
        <span>是真题感训练</span>
        <i>•</i>
        <span>每一道都讲清为什么</span>
      </section>

      <section className="library" id="library">
        <div className="section-heading">
          <div>
            <span className="eyebrow">QUESTION BANK</span>
            <h2>题库，从一个模块开始长大。</h2>
          </div>
          <p>按能力模块整理，也保留未来接入字节、腾讯、拼多多等历年题的空间。</p>
        </div>
        <article className="module-card">
          <div className="module-number">01</div>
          <div className="module-main">
            <div className="module-status">
              <span>当前可练</span>
              <em>{questions.length} 题</em>
            </div>
            <h3>图形推理</h3>
            <p>首批录入北森题库 1 前 5 题，覆盖位置、数量、去同存异与黑白运算。</p>
            <div className="tag-row">
              {counts.map(({ point }) => (
                <span key={point}>{point}</span>
              ))}
            </div>
          </div>
          <button onClick={() => setScreen("mode")} aria-label="打开图形推理模块">
            <span>进入模块</span>
            <b>↗</b>
          </button>
        </article>
        <div className="future-grid">
          <article>
            <span>02</span>
            <h3>言语理解</h3>
            <p>资料到位后更新</p>
          </article>
          <article>
            <span>03</span>
            <h3>数字推理</h3>
            <p>资料到位后更新</p>
          </article>
          <article>
            <span>04</span>
            <h3>大厂历年题</h3>
            <p>字节 · 腾讯 · 拼多多</p>
          </article>
        </div>
      </section>

      <section className="how-it-works">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ONE QUESTION, ONE LOOP</span>
            <h2>不是刷完就算，是每题都闭环。</h2>
          </div>
        </div>
        <div className="steps-grid">
          <article>
            <span>01</span>
            <h3>像考试一样看题</h3>
            <p>清爽大图、独立秒表，题面不带蓝框、答案字母和考点提示。</p>
          </article>
          <article>
            <span>02</span>
            <h3>确认提交再判定</h3>
            <p>选择阶段可反复修改，提交后才标记正确项与误选项。</p>
          </article>
          <article>
            <span>03</span>
            <h3>顺着推导学方法</h3>
            <p>从大类落到线型遍历、边数关系、去同存异等细颗粒考点。</p>
          </article>
        </div>
      </section>

      <footer>
        <Logo />
        <p>给正在准备秋招的我们，先把第一套题做好。</p>
        <button onClick={() => setScreen("mode")}>开始今天的 {questions.length} 题 →</button>
      </footer>
    </main>
  );
}
