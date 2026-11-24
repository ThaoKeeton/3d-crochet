import { edgeOf } from './builder';
import { bagPreset } from './piece';
import {
  buildChain,
  buildFoundationDemo,
  buildGranny,
  buildIncDec,
  buildMagicRing,
  buildSlipknot,
  buildSphere,
} from './motifs';
import { modelLesson } from './modelLesson';
import { stepsForGraph } from './teach';
import type { Graph, TeachStep, WeightId } from './types';
import { DEFAULT_COASTER, DEFAULT_STRAP } from './yarns';

export interface Lesson {
  id: string;
  title: string;
  kicker: string;
  summary: string;
  done: string;
  path: 0 | 1 | 2 | 3;
  minutes: number;
  graph: Graph;
  steps: TeachStep[];
  spin: number;
  color: string;
}

interface LessonSeed {
  id: string;
  title: string;
  kicker: string;
  summary: string;
  done: string;
  path: 0 | 1 | 2 | 3;
  minutes: number;
  spin: number;
  color: string;
  build: () => { graph: Graph; steps: TeachStep[] };
}

const SEEDS: LessonSeed[] = [
  {
    id: 'tools',
    title: '钩针和线',
    kicker: '第一步 · 动手之前',
    summary: '先认识针头、绕线和钩上的那一圈。活结打好，就可以开始锁针。',
    done: '钩上留着一个能滑动的圈，线尾轻轻一拉，圈会变小，但不会散开。',
    path: 1,
    minutes: 3,
    spin: 0,
    color: DEFAULT_STRAP,
    build: () => ({
      graph: buildSlipknot(),
      steps: stepsForGraph(buildSlipknot(), { rich: true }),
    }),
  },
  {
    id: 'chain',
    title: '锁针',
    kicker: '第一步 · 锁针带',
    summary: '每一针都是一个小环，套在上一针上。先钩出一条能看清的链。',
    done: '一条平整的锁针带，针目大小接近，没有拧成麻花。起针的线头留在一端。',
    path: 1,
    minutes: 6,
    spin: 0,
    color: DEFAULT_STRAP,
    build: () => {
      const graph = buildChain(8);
      return { graph, steps: stepsForGraph(graph, { rich: true }) };
    },
  },
  {
    id: 'slst',
    title: '引拔针',
    kicker: '第二步 · 把线连上',
    summary: '引拔针很矮，用来连接、收圈，也用来把方格缝到一起。',
    done: '新的一针几乎贴着原来的链，没有把织物垫高。钩上仍是一圈。',
    path: 2,
    minutes: 4,
    spin: 0,
    color: DEFAULT_COASTER,
    build: () => {
      const graph = buildFoundationDemo('slst');
      return { graph, steps: stepsForGraph(graph, { fromRound: 1, rich: true }) };
    },
  },
  {
    id: 'sc',
    title: '短针',
    kicker: '第二步 · 基本针',
    summary: '短针是最常用的实心针。入针、拉出、再收一次，钩上的圈数会变。',
    done: '织物上多了一小段结实的针目，顶上是一个 V，钩上回到一圈。',
    path: 2,
    minutes: 5,
    spin: 0,
    color: DEFAULT_COASTER,
    build: () => {
      const graph = buildFoundationDemo('sc');
      return { graph, steps: stepsForGraph(graph, { fromRound: 1, rich: true }) };
    },
  },
  {
    id: 'hdc',
    title: '中长针',
    kicker: '第二步 · 基本针',
    summary: '比短针高一点。先绕线再入针，收针时一次拉过三圈。',
    done: '这一针比短针高出一截，针身仍然结实，钩上回到一圈。',
    path: 2,
    minutes: 4,
    spin: 0,
    color: '#e08a4f',
    build: () => {
      const graph = buildFoundationDemo('hdc');
      return { graph, steps: stepsForGraph(graph, { fromRound: 1, rich: true }) };
    },
  },
  {
    id: 'dc',
    title: '长针',
    kicker: '第二步 · 杯垫就用它',
    summary: '祖母方格的柱子就是长针。绕线、入针，然后分两次各拉过两圈。',
    done: '一根直立的柱子，顶上留着钩针上的一圈。空隙留在柱子旁边，不在柱子里面。',
    path: 2,
    minutes: 6,
    spin: 0,
    color: DEFAULT_COASTER,
    build: () => {
      const graph = buildFoundationDemo('dc');
      return { graph, steps: stepsForGraph(graph, { fromRound: 1, rich: true }) };
    },
  },
  {
    id: 'incdec',
    title: '加针和减针',
    kicker: '第二步 · 让织物转弯',
    summary: '加针是同一针里钩两次。减针是相邻两针并成一针。',
    done: '加针的地方变宽，减针的地方收拢。两边的针目仍然连在同一根线上。',
    path: 2,
    minutes: 5,
    spin: 0,
    color: '#6e8f62',
    build: () => {
      const graph = buildIncDec();
      return { graph, steps: stepsForGraph(graph, { fromRound: 1, rich: true }) };
    },
  },
  {
    id: 'granny-round',
    title: '读一圈方格',
    kicker: '第二步 · 图解变成针',
    summary: '四个角，每个角是三根长针和两针锁针。先只走第一圈。',
    done: '一个小方框，四个角鼓出来，中间留着孔。四边的针数一样。',
    path: 2,
    minutes: 8,
    spin: 0,
    color: DEFAULT_COASTER,
    build: () => {
      const graph = buildGranny(1);
      return {
        graph,
        steps: stepsForGraph(graph, {
          fromRound: 1,
          rich: true,
          reveal: '第一圈完成。四个角，中间一个孔。接下来每一圈都沿着这些空隙往外长。',
        }),
      };
    },
  },
  {
    id: 'magic',
    title: '魔法环',
    kicker: '以后可以学',
    summary: '圆形起针的另一种开头。先把短针钩进环里，再拉紧。',
    done: '六针短针围成一个小圆，中间的孔被线尾拉拢，几乎看不见。',
    path: 0,
    minutes: 5,
    spin: 0,
    color: '#6aa39a',
    build: () => {
      const graph = buildMagicRing();
      return {
        graph,
        steps: stepsForGraph(graph, {
          fromRound: 1,
          rich: true,
          maxStitches: 6,
          closeOnLast: true,
          reveal: '线尾一拉，中间的环收拢。圆片、圆球都会从这里开始。',
        }),
      };
    },
  },
  {
    id: 'sphere',
    title: '圆球和耳朵',
    kicker: '以后可以学',
    summary: '主路是方格小袋。圆球是后面的分支：短针一圈圈加减，可以做成一个小头。',
    done: '一个结实的圆球。耳朵是另外两片小叶子，缝在两侧。',
    path: 0,
    minutes: 6,
    spin: 0,
    color: '#f0d3b0',
    build: () => {
      const graph = buildSphere();
      return {
        graph,
        steps: stepsForGraph(graph, {
          fromRound: 1,
          rich: true,
          maxStitches: 6,
          reveal: '第一圈是六针。后面按加针、平针、减针走完，就成了一个圆球。到构织台可以把耳朵装上。',
        }),
      };
    },
  },
];

const built = new Map<string, Lesson>();

export function lessonIndex(): Omit<Lesson, 'graph' | 'steps' | 'spin' | 'color'>[] {
  return SEEDS.map(({ build: _build, spin: _spin, color: _color, ...meta }) => meta);
}

export function getLesson(id: string): Lesson {
  if (id === 'model') {
    const live = modelLesson();
    if (live) return live;
  }
  const hit = built.get(id);
  if (hit) return hit;
  const seed = SEEDS.find((item) => item.id === id) ?? SEEDS[1];
  const made = seed.build();
  const lesson: Lesson = {
    id: seed.id,
    title: seed.title,
    kicker: seed.kicker,
    summary: seed.summary,
    done: seed.done,
    path: seed.path,
    minutes: seed.minutes,
    spin: seed.spin,
    color: seed.color,
    graph: made.graph,
    steps: made.steps,
  };
  built.set(id, lesson);
  return lesson;
}

export interface RoundPlan {
  round: number;
  title: string;
  body: string;
  total: number;
}

export function chainPattern(count: number): string {
  return [
    '锁针带',
    '',
    `钩 ${count} 针锁针。`,
    '起针留 15 厘米线头。',
    '每一针穿过上一针留下的那一圈，钩上始终只留一圈。',
    '结束时把线拉断，从最后一圈穿过去抽紧。',
  ].join('\n');
}

export function grannyPattern(rounds: number): string {
  const graph = buildGranny(rounds);
  const edge = edgeOf(graph, 's')?.count ?? 0;
  const lines = [
    '祖母方格杯垫',
    '',
    '材料',
    '中细棉线。钩针跟着线走，中细线常用 3.5 毫米。',
    '成品大约 10 厘米见方，具体看你的密度。',
    '',
    '起针',
    '锁 4 针，引拔成环。',
    '',
    '第 1 圈',
    '锁 3 针，算作第一根长针。环内再钩 2 长针，锁 2 针。',
    '（3 长针，锁 2 针）再重复 3 次。',
    '引拔到起始长针的顶上。得到四个角。',
  ];
  for (let round = 2; round <= rounds; round++) {
    const groups = round - 2;
    lines.push('', `第 ${round} 圈`);
    lines.push('引拔到角上的锁针空隙。');
    lines.push('每个角：3 长针，锁 2 针，3 长针。');
    if (groups <= 0) lines.push('角和角之间锁 1 针。');
    else lines.push(`每条边上有 ${groups} 个空隙，每个空隙里 3 长针，组与组之间锁 1 针。`);
    lines.push('一圈结束，引拔到起始长针的顶上。');
  }
  lines.push('', `外圈每边 ${edge} 针，四边相同。四块方格的圈数要一样，缝的时候才对齐。`, '断线，留 15 厘米，从反面把线头藏进针目。');
  return lines.join('\n');
}

export function bagPattern(): string {
  const edge = edgeOf(buildGranny(4), 's')?.count ?? 0;
  return [
    '四方小袋',
    '',
    '先钩 4 块相同的祖母方格，每块 4 圈。',
    `每边 ${edge} 针。有一块不一样，就先改圈数，不要硬缝。`,
    '',
    '缝合',
    '1. 正面的右边对右侧的左边，用引拔针一针针缝。',
    '2. 同样缝好四条竖缝，围成一只方筒。',
    '3. 底部向中心轻轻收拢，把底边缝严。',
    '4. 带子用短针，3 针宽。两端缝在袋口左右。',
    '',
    '藏好所有线头。袋口不收，带子就是提手。',
  ].join('\n');
}

export function projectRounds(id: string): RoundPlan[] {
  if (id === 'chain') {
    const total = 20;
    return [{ round: 0, title: '锁针', body: '钩 20 针锁针。每钩完一针，就在这里记一针。', total }];
  }
  const graph = buildGranny(4);
  const rounds: RoundPlan[] = [];
  const ring = graph.stitches.filter((stitch) => stitch.round === 0).length;
  rounds.push({ round: 0, title: '起针', body: '锁 4 针，引拔成环。环要能让第一圈的长针穿进去。', total: Math.max(1, ring) });
  for (let round = 1; round <= 4; round++) {
    const total = graph.stitches.filter((stitch) => stitch.round === round).length;
    const groups = round - 2;
    const body =
      round === 1
        ? '环里钩四个角：每个角 3 长针，角与角之间锁 2 针。'
        : groups <= 0
          ? '每个角的空隙里钩 3 长针、锁 2、再 3 长针。角之间锁 1 针。'
          : `每个角照旧。每条边上有 ${groups} 组 3 长针，组之间锁 1 针。`;
    rounds.push({ round, title: `第 ${round} 圈`, body, total });
  }
  return rounds;
}

export function projectGraph(id: string): Graph {
  if (id === 'chain') return buildChain(20);
  return buildGranny(4);
}

export function projectPattern(id: string): string {
  if (id === 'chain') return chainPattern(20);
  if (id === 'bag') return bagPattern();
  return grannyPattern(4);
}

export function revealDraw(graph: Graph, round: number, count: number): number {
  const denom = Math.max(1, graph.samples.length - 1);
  const inRound = graph.stitches.filter((stitch) => stitch.round === round);
  const done = Math.max(0, Math.min(count, inRound.length));
  if (done <= 0) {
    const earlier = graph.stitches.filter((stitch) => stitch.round < round);
    if (!earlier.length) return 0.02;
    return earlier[earlier.length - 1].sampleEnd / denom;
  }
  return inRound[done - 1].sampleEnd / denom;
}

export function bagStepPiece(step: number) {
  const full = bagPreset();
  const order = ['front', 'right', 'back', 'left'];
  const shown = new Set(order.slice(0, Math.min(4, Math.max(0, step))));
  if (step >= 9) shown.add('strap');
  const seamCount = step >= 5 ? Math.min(4, step - 4) : 0;
  return {
    ...full,
    modules: full.modules.filter((mod) => shown.has(mod.id)),
    seams: full.seams.slice(0, seamCount),
    gather: step >= 8,
  };
}

export const BAG_STEPS: { title: string; body: string }[] = [
  { title: '准备四块方格', body: '每块都是 4 圈祖母方格。先不要缝，确认四边针数一样。' },
  { title: '第一块 · 正面', body: '这是袋子的正面。杯垫的图解可以直接拿来钩这一块。' },
  { title: '第二块 · 右侧', body: '再钩一块同样的。圈数不要多，也不要少。' },
  { title: '第三块 · 背面', body: '第三块对着正面。针数还是和第一块一样。' },
  { title: '第四块 · 左侧', body: '四块齐了。接下来只缝，不再加针。' },
  { title: '缝第一条竖缝', body: '正面的右边对右侧的左边，引拔针一针对一针。' },
  { title: '缝第二条竖缝', body: '右侧再对上背面。线走到头，不要把角的空隙跳过。' },
  { title: '缝第三条竖缝', body: '背面再对上左侧。' },
  { title: '缝第四条竖缝', body: '左侧回到正面。四条缝连成一只方筒。' },
  { title: '装上带子', body: '3 针宽的短针带子，两端缝在袋口左右。底部向中心收一收。' },
];

export const WEIGHTS: { id: WeightId; name: string; mPer100: number; hook: string; pick: string; gauge: number }[] = [
  { id: 'fine', name: '细线', mPer100: 400, hook: '2.5–3.5 mm', pick: '3.0 mm', gauge: 24 },
  { id: 'sport', name: '中细', mPer100: 250, hook: '3.5–4.5 mm', pick: '3.5 mm', gauge: 20 },
  { id: 'worsted', name: '中粗', mPer100: 180, hook: '4.5–5.5 mm', pick: '5.0 mm', gauge: 16 },
  { id: 'bulky', name: '粗线', mPer100: 100, hook: '6–8 mm', pick: '6.5 mm', gauge: 12 },
];

export function estimateYarn(curveCm: number, weight: WeightId, userGauge?: number): {
  meters: number;
  grams: number;
  hook: string;
  pick: string;
  note: string;
} {
  const spec = WEIGHTS.find((item) => item.id === weight) ?? WEIGHTS[1];
  const gauge = userGauge && userGauge > 0 ? userGauge : spec.gauge;
  const meters = (curveCm / 100) * 1.12 * (spec.gauge / gauge);
  const grams = meters / (spec.mPer100 / 100);
  return {
    meters,
    grams,
    hook: spec.hook,
    pick: spec.pick,
    note: `线长来自这件作品的三维线迹，另加约一成线头和张力。${spec.name}大约 ${spec.mPer100} 米 / 100 克，建议钩针 ${spec.pick}。`,
  };
}

export function pieceYarnCm(graphs: Graph[]): number {
  return graphs.reduce((sum, graph) => sum + graph.lengthCm, 0);
}

export const PROJECTS = [
  {
    id: 'chain',
    title: '第一条锁针带',
    blurb: '20 针锁针。用来熟悉绕线和拉过，也是后面所有起针的开头。',
    path: 1 as const,
    minutes: 15,
  },
  {
    id: 'coaster',
    title: '祖母方格杯垫',
    blurb: '四圈长针和锁针空隙。钩完是一块可以垫杯子的方格。',
    path: 2 as const,
    minutes: 40,
  },
  {
    id: 'bag',
    title: '四方小袋',
    blurb: '四块同样的方格，加一条带子。针数对不齐就先改圈数。',
    path: 3 as const,
    minutes: 90,
  },
];
