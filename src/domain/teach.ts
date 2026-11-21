import { add, mulAdd, norm, scale, type Vec3 } from './math';
import type { Beat, Graph, Stitch, TeachStep } from './types';

export const HOOK_DIR: Vec3 = norm([0.58, 0.74, 0.3]);
const THROAT = 0.38;

const LOOP_COUNT: Record<string, number> = {
  'ch:insert': 1,
  'ch:wrap': 1,
  'ch:pull': 1,
  'ch:loop': 1,
  'slst:insert': 1,
  'slst:wrap': 1,
  'slst:pull': 1,
  'sc:insert': 1,
  'sc:wrap': 1,
  'sc:pull': 2,
  'sc:wrap2': 2,
  'sc:finish': 1,
  'hdc:wrap': 1,
  'hdc:insert': 1,
  'hdc:pull': 3,
  'hdc:finish': 1,
  'dc:wrap': 1,
  'dc:insert': 1,
  'dc:pull': 3,
  'dc:finish': 2,
  'dc:finish2': 1,
  'dec:insert': 1,
  'dec:pull': 2,
  'dec:insert2': 2,
  'dec:pull2': 3,
  'dec:finish': 1,
  'ring:insert': 0,
  'ring:wrap': 1,
  'ring:pull': 1,
  'ring:loop': 1,
};

const TITLE: Record<string, string> = {
  insert: '入针',
  insert2: '再入一针',
  wrap: '绕线',
  wrap2: '再绕线',
  pull: '拉出',
  pull2: '再拉出',
  loop: '当前这一圈',
  finish: '收针',
  finish2: '再收一次',
  travel: '带线',
};

const RICH: Record<string, string> = {
  'ch:insert': '钩上已经有一圈。下一针要穿过的就是它，针头就停在这个圈里。',
  'ch:wrap': '把线从钩针后面绕到前面。这一绕还没变成新的一圈，只是搭在针上。',
  'ch:pull': '钩住刚绕上的线，从原来的圈里拉出来。旧圈从针上脱掉。',
  'ch:loop': '钩上只留新的这一圈。它是一个小环，下一针还要再穿过它。',
  'slst:insert': '针头插进目标那一针的两根线下面。引拔针几乎不增加高度。',
  'slst:wrap': '绕线。动作很短，线只要搭上钩针。',
  'slst:pull': '一次拉过针目和钩上原来的圈。针上回到一圈，这一针就连上了。',
  'sc:insert': '针头插进下一针的两根线下面。现在钩上还是 1 圈。',
  'sc:wrap': '线从后向前绕过钩针。',
  'sc:pull': '从针目里把线拉出来。钩上变成 2 圈。',
  'sc:wrap2': '再绕一次线。两圈都还在钩上。',
  'sc:finish': '一次拉过这两圈。钩上回到 1 圈，短针完成。',
  'hdc:wrap': '中长针要先绕一次线，再去入针。线先搭在钩上。',
  'hdc:insert': '带着这一绕，把针头插进下一针。',
  'hdc:pull': '再绕线，从针目里拉出来。钩上是 3 圈。',
  'hdc:finish': '绕线，一次把 3 圈都拉过。钩上剩 1 圈。',
  'dc:wrap': '长针先绕线。这一绕搭在钩上，先别把它算成新的一圈。',
  'dc:insert': '针头插进指定的针目或空隙。柱子的高度从这里长出来。',
  'dc:pull': '再绕线，拉出来。现在钩上是 3 圈。',
  'dc:finish': '绕线，只拉过前面两圈。钩上还剩 2 圈。',
  'dc:finish2': '再绕线，拉过剩下的两圈。钩上回到 1 圈，这一针长针完成。',
  'dec:insert': '减针先做一个未完成的短针。针头插进第一针。',
  'dec:pull': '绕线，拉出来。先别收完，钩上现在有 2 圈。',
  'dec:insert2': '再插进下一针。两个针目会并成一针。',
  'dec:pull2': '再拉出一圈。钩上是 3 圈：原来的一圈，加上两个未完成的短针。',
  'dec:finish': '绕线，一次拉过这 3 圈。两针并成了一针。',
  'ring:insert': '线在手指上绕成一个圈。圈先别拉死。',
  'ring:wrap': '钩针从圈中间伸进去，把连着线团的线绕上。',
  'ring:pull': '拉出一根线，成为一个活结。',
  'ring:loop': '钩上留这一圈。轻轻拉线尾，圈会缩小。',
};

const LATER: Record<string, string> = {
  'ch:insert': '针头还在上一针留下的圈里。',
  'ch:wrap': '再绕一次，手势和第一针一样。',
  'ch:pull': '拉过，旧圈脱掉。',
  'ch:loop': '新的一圈留在钩上。链子长了一节。',
  'sc:insert': '插入下一针。',
  'sc:wrap': '绕线。',
  'sc:pull': '拉出。钩上 2 圈。',
  'sc:wrap2': '再绕线。',
  'sc:finish': '拉过两圈，短针完成。',
  'dc:wrap': '先绕线。',
  'dc:insert': '插入空隙。',
  'dc:pull': '绕线拉出，钩上 3 圈。',
  'dc:finish': '拉过两圈，钩上剩 2 圈。',
  'dc:finish2': '再拉过两圈，长针完成。',
};

const LIGHT: Record<Beat, 'insert' | 'wrap' | 'loop'> = {
  insert: 'insert',
  insert2: 'insert',
  wrap: 'wrap',
  wrap2: 'wrap',
  pull: 'loop',
  pull2: 'loop',
  loop: 'loop',
  finish: 'loop',
  finish2: 'loop',
  travel: 'loop',
};

export function beatLight(beat: Beat): 'insert' | 'wrap' | 'loop' {
  return LIGHT[beat];
}

export function stepsForGraph(
  graph: Graph,
  options: { fromRound?: number; rich?: boolean; closeOnLast?: boolean; maxStitches?: number; reveal?: string } = {},
): TeachStep[] {
  const fromRound = options.fromRound ?? 0;
  const stitches = graph.stitches
    .filter((stitch) => stitch.round >= fromRound && stitch.kind !== 'ring')
    .slice(0, options.maxStitches ?? 10_000);
  const steps: TeachStep[] = [];
  stitches.forEach((stitch, index) => {
    const ranges = beatRanges(graph, stitch);
    const beats = ranges.map((range) => range.beat);
    beats.forEach((beat, beatIndex) => {
      const range = ranges[beatIndex];
      const rich = options.rich && index === 0;
      const key = `${stitch.kind}:${beat}`;
      const body = (rich ? RICH[key] : LATER[key]) ?? RICH[key] ?? '跟着钩针看这一下。';
      const draw = range.end / Math.max(1, graph.samples.length - 1);
      const previous = index > 0 ? stitches[index - 1] : null;
      const focus = beat === 'insert' || beat === 'insert2' ? (beat === 'insert2' ? stitch.insertion2 ?? stitch.loop : stitch.insertion ?? stitch.loop) : stitch.loop;
      const holding = beat === 'insert' || beat === 'insert2';
      const anchor = holding ? focus : stitch.loop;
      const dir = HOOK_DIR;
      const hookTip = holding ? mulAdd(anchor, dir, -0.04) : mulAdd(anchor, dir, -THROAT);
      steps.push({
        id: `${stitch.id}:${beat}`,
        stitchId: stitch.id,
        stitchIndex: index,
        stitchTotal: stitches.length,
        kind: stitch.kind,
        beat,
        title: TITLE[beat] ?? '下一步',
        body,
        loops: LOOP_COUNT[key] ?? 1,
        draw,
        hi: [range.start / Math.max(1, graph.samples.length - 1), draw],
        done: previous ? alongRange(graph, previous.sampleStart, previous.sampleEnd) : null,
        insertion: beat === 'insert2' ? stitch.insertion2 : stitch.insertion,
        loop: stitch.loop,
        focus,
        hookTip,
        hookDir: dir,
        showWrap: beat === 'wrap' || beat === 'wrap2',
        closeRing: options.closeOnLast && index === stitches.length - 1 && beatIndex === beats.length - 1 ? 1 : 0,
      });
    });
  });
  if (options.reveal && steps.length) {
    const last = steps[steps.length - 1];
    steps.push({
      ...last,
      id: `${last.id}:reveal`,
      title: '完成的样子',
      body: options.reveal,
      draw: 1,
      hi: [0, 0],
      done: null,
      showWrap: false,
      closeRing: options.closeOnLast ? 1 : last.closeRing,
      beat: 'finish',
    });
  }
  return steps;
}

function beatRanges(graph: Graph, stitch: Stitch): { beat: Beat; start: number; end: number }[] {
  const ranges: { beat: Beat; start: number; end: number }[] = [];
  for (let i = stitch.sampleStart; i <= stitch.sampleEnd; i++) {
    const beat = graph.samples[i].beat;
    const last = ranges[ranges.length - 1];
    if (!last || last.beat !== beat) ranges.push({ beat, start: i, end: i });
    else last.end = i;
  }
  return ranges.filter((range) => range.beat !== 'travel');
}

function alongRange(graph: Graph, start: number, end: number): [number, number] {
  const denom = Math.max(1, graph.samples.length - 1);
  return [start / denom, end / denom];
}

export function focusPose(focus: Vec3, radius: number): { target: Vec3; camera: Vec3 } {
  const distance = Math.max(3.4, radius * 1.45);
  return {
    target: focus,
    camera: add(focus, scale(norm([0.85, 0.72, 1.15]), distance)),
  };
}

export function overviewPose(center: Vec3, size: number): { target: Vec3; camera: Vec3 } {
  const distance = Math.max(5.6, size * 1.7);
  return {
    target: center,
    camera: add(center, scale(norm([0.58, 0.52, 1]), distance)),
  };
}

export function hookEyePose(tip: Vec3, dir: Vec3): { target: Vec3; camera: Vec3 } {
  return {
    target: add(tip, scale(dir, 0.15)),
    camera: add(tip, add(scale(dir, 1.35), [0.15, 0.35, 0.2])),
  };
}
