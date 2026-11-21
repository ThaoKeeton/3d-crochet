import { GraphBuilder, splitByLength, type StitchPart } from './builder';
import {
  add,
  dist,
  lerp,
  lerpNum,
  mulAdd,
  norm,
  scale,
  type Vec3,
} from './math';
import type { EdgeId, Graph, StitchKind } from './types';

/** Scene units are centimeters. Yarn is a little thicker than sewing cotton so it reads on a phone. */
export const YARN_RADIUS = 0.16;

const THICK: Vec3 = [0, 0, 1];

interface Frame {
  p: Vec3;
  tangent: Vec3;
  out: Vec3;
}

const graphCache = new Map<string, Graph>();

export function cachedGraph(key: string, build: () => Graph): Graph {
  const hit = graphCache.get(key);
  if (hit) return hit;
  const graph = build();
  graphCache.set(key, graph);
  return graph;
}

export function buildChain(count: number): Graph {
  return cachedGraph(`chain:${count}`, () => {
    const b = new GraphBuilder();
    b.hintEdge('start', [0, 1, 0], [-1, 0, 0]);
    b.hintEdge('end', [0, 1, 0], [1, 0, 0]);
    for (let i = 0; i < count; i++) {
      const pts = chainLink(i);
      const edge: EdgeId | null = i === 0 ? 'start' : i === count - 1 ? 'end' : null;
      b.stitch({
        kind: 'ch',
        round: 0,
        edge,
        insertion: i === 0 ? null : ([i * 0.86 - 0.2, 0.3, 0] as Vec3),
        parts: chainParts(pts),
      });
    }
    return b.finish(`chain-${count}`);
  });
}

export function buildSlipknot(): Graph {
  return cachedGraph('slipknot', () => {
    const b = new GraphBuilder();
    const loop: Vec3[] = [];
    for (let i = 0; i <= 18; i++) {
      const a = -0.4 + (i / 18) * (Math.PI * 2 + 0.2);
      loop.push([Math.cos(a) * 0.46, 0.52 + Math.sin(a) * 0.4, Math.sin(a * 2) * 0.05]);
    }
    const through: Vec3[] = [
      [0.1, 0.5, 0.02],
      [0.02, 0.78, 0.16],
      [-0.08, 0.95, 0.05],
      [0.05, 1.05, 0],
    ];
    b.stitch({
      kind: 'ring',
      round: 0,
      ringCenter: [0, 0.52, 0],
      parts: [
        { beat: 'insert', points: loop.slice(0, 8) },
        { beat: 'wrap', points: loop.slice(7, 14) },
        { beat: 'pull', points: loop.slice(13).concat(through.slice(0, 2)) },
        { beat: 'loop', points: through },
      ],
    });
    return b.finish('slipknot');
  });
}

export function buildIncDec(): Graph {
  return cachedGraph('incdec', () => {
    const b = new GraphBuilder();
    for (let i = 0; i < 8; i++) {
      b.stitch({
        kind: 'ch',
        round: 0,
        insertion: i === 0 ? null : chainInsert(i),
        parts: chainParts(chainLink(i)),
      });
    }
    const into = chainTop(3);
    const head: Vec3 = [into[0], into[1] + 0.5, 0.02];
    emitPost(b, 'sc', 1, head, into, [1, 0, 0], null, []);
    emitPost(b, 'sc', 1, add(head, [0.46, 0.02, 0]), into, [1, 0, 0], null, []);
    emitDecrease(b, chainTop(5), chainTop(6), [chainTop(5)[0] + 0.3, chainTop(5)[1] + 0.55, 0.02]);
    return b.finish('incdec');
  });
}

export function buildFoundationDemo(kind: 'sc' | 'hdc' | 'dc' | 'slst' | 'inc' | 'dec'): Graph {
  return cachedGraph(`demo:${kind}`, () => {
    const b = new GraphBuilder();
    const chains = 8;
    for (let i = 0; i < chains; i++) {
      b.stitch({
        kind: 'ch',
        round: 0,
        insertion: i === 0 ? null : chainInsert(i),
        parts: chainParts(chainLink(i)),
      });
    }
    const target = 4;
    const into = chainTop(target);
    const into2 = chainTop(target + 1);
    const head: Vec3 = [into[0], into[1] + (kind === 'dc' ? 1.15 : kind === 'hdc' ? 0.78 : 0.48), 0.02];
    if (kind === 'inc') {
      emitPost(b, 'sc', 1, head, into, [1, 0, 0], null, ['ch-0-4']);
      emitPost(b, 'sc', 1, add(head, [0.42, 0, 0]), into, [1, 0, 0], null, ['ch-0-4']);
    } else if (kind === 'dec') {
      emitDecrease(b, into, into2, head);
    } else if (kind === 'slst') {
      emitPost(b, 'slst', 1, [into[0], into[1] + 0.16, 0.02], into, [1, 0, 0], null, []);
    } else {
      emitPost(b, kind, 1, head, into, [1, 0, 0], null, []);
    }
    return b.finish(`demo-${kind}`);
  });
}

export function buildMagicRing(): Graph {
  return cachedGraph('magic', () => {
    const b = new GraphBuilder();
    emitRing(b, 0.7, 0);
    const center: Vec3 = [0, 0, 0];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const head: Vec3 = [Math.cos(a) * 1.35, Math.sin(a) * 1.35, 0.05];
      const tangent: Vec3 = [-Math.sin(a), Math.cos(a), 0];
      emitPost(b, 'sc', 1, head, mulAdd(center, norm(head), 0.25), tangent, null, ['ring']);
    }
    return b.finish('magic');
  });
}

export function buildDisc(rounds: number): Graph {
  return cachedGraph(`disc:${rounds}`, () => {
    const b = new GraphBuilder();
    b.hintEdge('rim', [0, 1, 0], [1, 0, 0]);
    emitRing(b, 0.42, 0);
    for (let round = 1; round <= rounds; round++) {
      const count = 6 * round;
      const radius = 0.62 * round;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 - Math.PI / 2;
        const head: Vec3 = [Math.cos(a) * radius, Math.sin(a) * radius, 0.04];
        const tangent: Vec3 = [-Math.sin(a), Math.cos(a), 0];
        const insert: Vec3 = [Math.cos(a) * Math.max(0.2, radius - 0.62), Math.sin(a) * Math.max(0.2, radius - 0.62), 0];
        const edge: EdgeId | null = round === rounds && i % 2 === 0 ? 'rim' : null;
        emitPost(b, 'sc', round, head, insert, tangent, edge, []);
      }
    }
    return b.finish(`disc-${rounds}`);
  });
}

export function buildStrap(width: number, rows: number): Graph {
  return cachedGraph(`strap:${width}x${rows}`, () => {
    const b = new GraphBuilder();
    b.hintEdge('start', [0, 1, 0], [-1, 0, 0]);
    b.hintEdge('end', [0, 1, 0], [1, 0, 0]);
    const pitch = 0.46;
    const spread = 0.38;
    const length = Math.max(1, rows - 1) * pitch;
    for (let row = 0; row < rows; row++) {
      const dir = row % 2 === 0 ? 1 : -1;
      for (let k = 0; k < width; k++) {
        const i = dir === 1 ? k : width - 1 - k;
        const x = -length / 2 + row * pitch;
        const y = (i - (width - 1) / 2) * spread;
        const head: Vec3 = [x, y, 0.02];
        const tangent: Vec3 = [0, dir, 0];
        const insert: Vec3 = [x - pitch * 0.85, y, 0];
        const edge: EdgeId | null = row === 0 ? 'start' : row === rows - 1 ? 'end' : null;
        emitPost(b, 'sc', row, head, row === 0 ? head : insert, tangent, edge, []);
      }
    }
    return b.finish(`strap-${width}x${rows}`);
  });
}

export function buildEar(rounds: number): Graph {
  return cachedGraph(`ear:${rounds}`, () => {
    const b = new GraphBuilder();
    b.hintEdge('base', [1, 0, 0], [0, -1, 0]);
    emitRing(b, 0.28, 0);
    const safe = Math.max(1, Math.min(3, rounds));
    for (let round = 1; round <= safe; round++) {
      const count = 4 + (round - 1) * 4;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 - Math.PI / 2;
        const rx = 0.48 * round;
        const ry = 0.72 * round;
        const head: Vec3 = [Math.cos(a) * rx, Math.sin(a) * ry, 0.08 + Math.max(0, Math.sin(a)) * -0.18];
        const tangent: Vec3 = norm([-Math.sin(a) * rx, Math.cos(a) * ry, 0]);
        const insert: Vec3 = [Math.cos(a) * rx * 0.45, Math.sin(a) * ry * 0.45, 0];
        const edge: EdgeId | null = round === safe && head[1] < -ry * 0.25 ? 'base' : null;
        emitPost(b, 'sc', round, head, insert, tangent, edge, []);
      }
    }
    return b.finish(`ear-${safe}`);
  });
}

export function buildSphere(): Graph {
  return cachedGraph('sphere', () => {
    const b = new GraphBuilder();
    b.hintEdge('left', [0, 1, 0], [-1, 0, 0]);
    b.hintEdge('right', [0, 1, 0], [1, 0, 0]);
    const counts = [6, 12, 18, 24, 30, 30, 24, 18, 12, 6];
    const radius = 2.35;
    emitRing(b, 0.28, radius * 0.92);
    for (let round = 0; round < counts.length; round++) {
      const v = round / (counts.length - 1);
      const phi = v * Math.PI;
      const y = Math.cos(phi) * radius;
      const ring = Math.max(0.2, Math.sin(phi) * radius);
      const count = counts[round];
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + (round % 2) * 0.18;
        const head: Vec3 = [Math.cos(a) * ring, y, Math.sin(a) * ring];
        const normal = norm(head);
        const tangent: Vec3 = norm([-Math.sin(a), 0, Math.cos(a)]);
        const insert = scale(head, 0.78);
        let edge: EdgeId | null = null;
        if (round === 4) {
          const ang = Math.atan2(head[2], head[0]);
          if (Math.abs(ang) < 0.42) edge = 'right';
          if (Math.abs(Math.abs(ang) - Math.PI) < 0.42) edge = 'left';
        }
        emitOrientedPost(b, 'sc', round + 1, head, insert, tangent, normal, edge);
      }
    }
    return b.finish('sphere');
  });
}

export function grannyReach(round: number): number {
  return 1.2 + (round - 1) * 1.28;
}

export function buildGranny(rounds: number): Graph {
  return cachedGraph(`granny:${rounds}`, () => {
    const b = new GraphBuilder();
    (['s', 'e', 'n', 'w'] as const).forEach((id, index) => {
      const tangent: Vec3 = index === 0 ? [1, 0, 0] : index === 1 ? [0, 1, 0] : index === 2 ? [-1, 0, 0] : [0, -1, 0];
      const outward: Vec3 = index === 0 ? [0, -1, 0] : index === 1 ? [1, 0, 0] : index === 2 ? [0, 1, 0] : [-1, 0, 0];
      b.hintEdge(id, tangent, outward);
    });
    emitRing(b, 0.58, 0);
    const cornerAt: Vec3[][] = [];
    const sideAt: Vec3[][][] = [];
    for (let round = 1; round <= rounds; round++) {
      const reach = grannyReach(round);
      const prevCorners = cornerAt[round - 1] ?? [];
      const prevSides = sideAt[round - 1] ?? [];
      const nextCorners: Vec3[] = [];
      const nextSides: Vec3[][] = [[], [], [], []];
      const mark = b.stitches.length;
      for (let side = 0; side < 4; side++) {
        const edge: EdgeId | null = round === rounds ? (['s', 'e', 'n', 'w'] as const)[side] : null;
        const corner = side;
        const insertCorner = round === 1 ? cornerInset(corner, 0.22) : prevCorners[corner] ?? cornerInset(corner, 0.3);
        if (round === 1) {
          const frame = roundOneCorner(corner, reach);
          emitShell(b, round, frame, insertCorner, edge, `c-${round - 1}-${corner}`);
          const arc = chainBulge(b.last() ?? frame.p, roundOneCorner((corner + 1) % 4, reach).p, frame.out, 0.46);
          const space = emitChains(b, round, arc, 2, edge, 'corner');
          nextCorners[corner] = space;
          b.addSpace({ id: `c-${round}-${corner}`, round, kind: 'corner', at: space });
        } else {
          const lead = cornerShell(corner, reach, -1);
          const trail = cornerShell(corner, reach, 1);
          emitShell(b, round, lead, insertCorner, edge, `c-${round - 1}-${corner}`);
          const cornerArc = chainBulge(b.last() ?? lead.p, trail.p, norm(add(lead.out, trail.out)), 0.5);
          const space = emitChains(b, round, cornerArc, 2, edge, 'corner');
          nextCorners[corner] = space;
          b.addSpace({ id: `c-${round}-${corner}`, round, kind: 'corner', at: space });
          emitShell(b, round, trail, insertCorner, edge, `c-${round - 1}-${corner}`);
          const prevSide = prevSides[side] ?? [];
          const groups = Math.max(0, round - 2);
          for (let g = 0; g < groups; g++) {
            const along = (g + 1) / (groups + 1);
            const frame = sideFrame(side, along, reach);
            const approach = mulAdd(frame.p, frame.tangent, -0.62);
            const gap = chainBulge(b.last() ?? approach, approach, frame.out, 0.16);
            const sideSpace = emitChains(b, round, gap, 1, edge, 'side');
            nextSides[side].push(sideSpace);
            b.addSpace({ id: `s-${round}-${side}-${g}`, round, kind: 'side', at: sideSpace });
            const into = prevSide[g] ?? insertCorner;
            emitShell(b, round, frame, into, edge, `s-${round - 1}-${side}-${g}`);
          }
          const nextLead = cornerShell((corner + 1) % 4, reach, -1);
          const closing = chainBulge(b.last() ?? nextLead.p, nextLead.p, sideFrame(side, 0.96, reach).out, 0.16);
          const tailSpace = emitChains(b, round, closing, 1, edge, 'side');
          nextSides[side].push(tailSpace);
          b.addSpace({ id: `s-${round}-${side}-tail`, round, kind: 'side', at: tailSpace });
        }
      }
      const first = b.stitches[mark];
      const from = b.last();
      if (first && from && dist(from, first.loop) > 0.08 && dist(from, first.loop) < 2.2) {
        b.stitch({
          kind: 'slst',
          round,
          insertion: first.loop,
          parts: [{ beat: 'pull', points: [from, lerp(from, first.loop, 0.5), first.loop] }],
        });
      }
      cornerAt[round] = nextCorners;
      sideAt[round] = nextSides;
    }
    return b.finish(`granny-${rounds}`);
  });
}

export function buildModuleGraph(kind: string, params: { rounds?: number; stitches?: number; rows?: number; width?: number }): Graph {
  if (kind === 'chain') return buildChain(params.stitches ?? 16);
  if (kind === 'round') return buildDisc(params.rounds ?? 5);
  if (kind === 'granny') return buildGranny(params.rounds ?? 4);
  if (kind === 'sphere') return buildSphere();
  if (kind === 'ear') return buildEar(params.rounds ?? 3);
  return buildStrap(params.width ?? 3, params.rows ?? 28);
}

function emitRing(b: GraphBuilder, radius: number, z: number) {
  const steps = 4;
  const points: Vec3[] = [];
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    points.push([Math.cos(a) * radius, Math.sin(a) * radius, z + Math.sin(a * 2) * 0.035]);
  }
  const center: Vec3 = [0, 0, z];
  const chunk = Math.floor(points.length / steps);
  for (let s = 0; s < steps; s++) {
    const slice = points.slice(s * chunk, s === steps - 1 ? points.length : (s + 1) * chunk + 1);
    b.stitch({
      kind: 'ch',
      round: 0,
      ringCenter: center,
      into: [],
      parts: [{ beat: 'loop', points: slice }],
    });
  }
  b.addSpace({ id: 'ring', round: 0, kind: 'ring', at: center });
}

function emitShell(
  b: GraphBuilder,
  round: number,
  frame: Frame,
  insert: Vec3,
  edge: EdgeId | null,
  into: string,
) {
  for (let i = 0; i < 3; i++) {
    const offset = (i - 1) * 0.3;
    const head = mulAdd(frame.p, frame.tangent, offset);
    const foot = mulAdd(insert, frame.tangent, offset * 0.22);
    emitPost(b, 'dc', round, head, foot, frame.tangent, edge, [into]);
  }
}

function emitChains(
  b: GraphBuilder,
  round: number,
  arc: Vec3[],
  count: number,
  edge: EdgeId | null,
  role: 'corner' | 'side',
): Vec3 {
  if (arc.length < 2) return arc[0] ?? [0, 0, 0];
  const cuts = Math.max(1, count);
  for (let i = 0; i < cuts; i++) {
    const a = Math.floor((i / cuts) * (arc.length - 1));
    const c = Math.floor(((i + 1) / cuts) * (arc.length - 1));
    const slice = arc.slice(a, c + 1);
    b.stitch({
      kind: 'ch',
      round,
      edge,
      parts: [{ beat: 'loop', points: slice.length ? slice : arc }],
    });
  }
  const mid = arc[Math.floor(arc.length / 2)] ?? arc[0];
  return add(mid, [0, 0, role === 'corner' ? 0.02 : 0]);
}

function emitPost(
  b: GraphBuilder,
  kind: StitchKind,
  round: number,
  head: Vec3,
  insert: Vec3,
  tangent: Vec3,
  edge: EdgeId | null,
  into: string[],
) {
  const from = b.last() ?? mulAdd(head, tangent, -0.32);
  b.stitch({
    kind,
    round,
    edge,
    into,
    insertion: insert,
    parts: postParts(kind, from, head, insert, tangent),
  });
}

function emitOrientedPost(
  b: GraphBuilder,
  kind: StitchKind,
  round: number,
  head: Vec3,
  insert: Vec3,
  tangent: Vec3,
  normal: Vec3,
  edge: EdgeId | null,
) {
  const from = b.last() ?? add(head, scale(tangent, -0.2));
  const pts = orientedBump(from, head, insert, tangent, normal);
  b.stitch({
    kind,
    round,
    edge,
    insertion: insert,
    parts: splitByLength(pts, [
      { beat: 'insert', until: 0.28 },
      { beat: 'wrap', until: 0.48 },
      { beat: 'pull', until: 0.72 },
      { beat: 'finish', until: 1 },
    ]),
  });
}

function emitDecrease(b: GraphBuilder, first: Vec3, second: Vec3, head: Vec3) {
  const from = b.last() ?? first;
  const pts: Vec3[] = [
    from,
    add(first, [0, 0.16, 0.18]),
    first,
    add(first, [0.08, 0.05, -0.04]),
    lerp(first, second, 0.5),
    add(second, [0, 0.16, 0.16]),
    second,
    add(second, [0.06, 0.2, 0.18]),
    add(head, [0, 0, 0.16]),
    head,
  ];
  b.stitch({
    kind: 'dec',
    round: 1,
    insertion: first,
    insertion2: second,
    parts: splitByLength(pts, [
      { beat: 'insert', until: 0.22 },
      { beat: 'pull', until: 0.4 },
      { beat: 'insert2', until: 0.62 },
      { beat: 'pull2', until: 0.8 },
      { beat: 'finish', until: 1 },
    ]),
  });
}

function postParts(kind: StitchKind, from: Vec3, head: Vec3, insert: Vec3, tangent: Vec3): StitchPart[] {
  const height = kind === 'dc' ? 0.32 : kind === 'hdc' ? 0.24 : kind === 'slst' ? 0.12 : 0.2;
  const yo = add(head, [0, 0, height]);
  const leg = kind === 'slst' ? 0.09 : 0.15;
  const u: Vec3[] = [];
  for (let i = 0; i <= 5; i++) {
    const t = i / 5;
    const along = Math.cos(Math.PI * (1 - t));
    const dip = -Math.sin(Math.PI * t);
    u.push(add(insert, add(scale(tangent, along * leg), [0, 0, 0.02 + dip * 0.07])));
  }
  const rising = lerp(u[5], head, 0.62);
  const crown = add(head, [0, 0, height * 0.62]);
  const exit = mulAdd(head, tangent, kind === 'slst' ? 0.16 : 0.26);
  if (kind === 'dc') {
    return [
      { beat: 'wrap', points: [from, lerp(from, yo, 0.55), yo, add(yo, scale(tangent, 0.12))] },
      { beat: 'insert', points: [add(yo, scale(tangent, 0.12)), lerp(yo, insert, 0.5), u[0], u[2]] },
      { beat: 'pull', points: [u[2], u[5], rising] },
      { beat: 'finish', points: [rising, crown] },
      { beat: 'finish2', points: [crown, exit] },
    ];
  }
  if (kind === 'hdc') {
    return [
      { beat: 'wrap', points: [from, yo] },
      { beat: 'insert', points: [yo, lerp(yo, insert, 0.55), u[2]] },
      { beat: 'pull', points: [u[2], u[5], rising] },
      { beat: 'finish', points: [rising, exit] },
    ];
  }
  if (kind === 'slst') {
    return [
      { beat: 'insert', points: [from, lerp(from, insert, 0.7), u[1]] },
      { beat: 'wrap', points: [u[1], add(u[3], [0, 0, 0.12])] },
      { beat: 'pull', points: [add(u[3], [0, 0, 0.12]), exit] },
    ];
  }
  const mid = add(head, [0, 0, height * 0.45]);
  return [
    { beat: 'insert', points: [from, lerp(from, insert, 0.65), u[1]] },
    { beat: 'wrap', points: [u[1], add(u[2], [0, 0, 0.16])] },
    { beat: 'pull', points: [add(u[2], [0, 0, 0.16]), u[5], rising] },
    { beat: 'wrap2', points: [rising, mid] },
    { beat: 'finish', points: [mid, exit] },
  ];
}

function orientedBump(from: Vec3, head: Vec3, insert: Vec3, tangent: Vec3, normal: Vec3): Vec3[] {
  const n = normal;
  const crown = add(head, scale(n, 0.22));
  const side = add(head, scale(tangent, 0.16));
  return [
    from,
    lerp(from, crown, 0.45),
    crown,
    lerp(crown, insert, 0.55),
    insert,
    lerp(insert, side, 0.5),
    side,
    add(head, scale(tangent, 0.24)),
  ];
}

function chainLink(index: number): Vec3[] {
  const pitch = 1.02;
  const x = index * pitch;
  const flip = index % 2 === 0 ? 1 : -1;
  const pts: Vec3[] = [];
  const n = 16;
  for (let s = 0; s <= n; s++) {
    const t = s / n;
    const a = -0.35 + t * (Math.PI + 1.15);
    pts.push([
      x + 0.28 + Math.cos(a) * 0.4,
      0.62 + Math.sin(a) * 0.46,
      Math.sin(a) * 0.12 * flip,
    ]);
  }
  pts.push([x + pitch, 0.58, 0]);
  return pts;
}

function chainParts(pts: Vec3[]): StitchPart[] {
  return splitByLength(pts, [
    { beat: 'insert', until: 0.22 },
    { beat: 'wrap', until: 0.48 },
    { beat: 'pull', until: 0.78 },
    { beat: 'loop', until: 1 },
  ]);
}

function chainTop(index: number): Vec3 {
  return [index * 1.02 + 0.36, 0.62, 0];
}

function chainInsert(index: number): Vec3 {
  return [index * 1.02 - 0.05, 0.58, 0];
}

function sideFrame(side: number, along: number, reach: number): Frame {
  const t = along;
  if (side === 0) return { p: [lerpNum(-reach, reach, t), -reach, 0.06], tangent: [1, 0, 0], out: [0, -1, 0] };
  if (side === 1) return { p: [reach, lerpNum(-reach, reach, t), 0.06], tangent: [0, 1, 0], out: [1, 0, 0] };
  if (side === 2) return { p: [lerpNum(reach, -reach, t), reach, 0.06], tangent: [-1, 0, 0], out: [0, 1, 0] };
  return { p: [-reach, lerpNum(reach, -reach, t), 0.06], tangent: [0, -1, 0], out: [-1, 0, 0] };
}

function cornerShell(corner: number, reach: number, fan: number): Frame {
  const side = fan < 0 ? (corner + 3) % 4 : corner;
  const along = fan < 0 ? 0.9 : 0.1;
  const frame = sideFrame(side, along, reach);
  return {
    p: mulAdd(frame.p, frame.tangent, fan < 0 ? -0.08 : 0.08),
    tangent: frame.tangent,
    out: frame.out,
  };
}

function roundOneCorner(corner: number, reach: number): Frame {
  const signs = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ][corner];
  const inset = reach * 0.78;
  const p: Vec3 = [signs[0] * inset, signs[1] * inset, 0.06];
  const out = norm([signs[0], signs[1], 0]);
  const tangent = norm([-signs[1], signs[0], 0]);
  return { p, tangent, out };
}

function cornerInset(corner: number, radius: number): Vec3 {
  const signs = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ][corner];
  return [signs[0] * radius, signs[1] * radius, 0];
}

function chainBulge(from: Vec3, to: Vec3, out: Vec3, amount: number): Vec3[] {
  if (dist(from, to) < 0.04) return [from, to];
  const pts: Vec3[] = [];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = lerp(from, to, t);
    const s = Math.sin(Math.PI * t);
    pts.push(add(p, add(scale(out, amount * s), scale(THICK, 0.16 * s))));
  }
  return pts;
}
