import { edgeOf } from './builder';
import {
  add,
  clamp,
  dist,
  dot,
  lerp,
  norm,
  quatFromAxisAngle,
  quatFromBasis,
  quatRotate,
  scale,
  sub,
  transformPoint,
  type Quat,
  type Vec3,
} from './math';
import { buildGranny, buildModuleGraph, grannyReach } from './motifs';
import { DEFAULT_SQUARE, DEFAULT_STRAP } from './yarns';
import type { Edge, EdgeId, Graph, ModuleInstance, ModuleKind, Piece, Seam } from './types';

export interface SeamIssue {
  seamId: string;
  moduleId: string;
  edge: EdgeId;
  countA: number;
  countB: number;
  message: string;
  proposal: { moduleId: string; rounds?: number; width?: number } | null;
}

const cache = new Map<string, { graph: Graph }>();

export function moduleGraph(mod: ModuleInstance): Graph {
  const key = `${mod.kind}:${JSON.stringify(mod.params)}`;
  const hit = cache.get(key);
  if (hit) return hit.graph;
  const graph = buildModuleGraph(mod.kind, mod.params);
  cache.set(key, { graph });
  return graph;
}

export function modulePoint(mod: ModuleInstance, p: Vec3): Vec3 {
  return transformPoint(bendPoint(mod, p), mod.position, mod.rotation, mod.scale);
}

export function bendPoint(mod: ModuleInstance, p: Vec3): Vec3 {
  if (mod.form !== 'wall' || mod.bend <= 0) return p;
  const graph = moduleGraph(mod);
  const ySpan = Math.max(0.001, graph.max[1] - graph.min[1]);
  const xSpan = Math.max(0.001, graph.max[0] - graph.min[0]);
  const up = clamp((p[1] - graph.min[1]) / (ySpan * 0.7), 0, 1);
  const side = clamp(Math.abs(p[0] - graph.center[0]) / (xSpan * 0.5), 0, 1);
  // A shallow tuck. Corners stay put so the side seams meet, and the middle
  // only eases in — the base is a hem, not a point.
  const bend = (1 - up) * (1 - up) * (1 - side * 0.94) * mod.bend * 0.34;
  return [p[0], p[1] + bend * 0.02, p[2] - bend];
}

export function worldEdge(mod: ModuleInstance, edgeId: EdgeId): { points: Vec3[]; center: Vec3; count: number } | null {
  const edge = edgeOf(moduleGraph(mod), edgeId);
  if (!edge) return null;
  const points = edge.points.map((p) => modulePoint(mod, p));
  const center = lerp(points[0], points[points.length - 1], 0.5);
  return { points, center, count: edge.count };
}

export function bagPreset(): Piece {
  const rounds = 4;
  const graph = buildGranny(rounds);
  const reach = Math.max(Math.abs(graph.min[0]), Math.abs(graph.max[0]), grannyReach(rounds));
  const lift = -graph.min[1];
  const yaw = (degrees: number): Quat => quatFromAxisAngle([0, 1, 0], (degrees * Math.PI) / 180);
  const square = (id: string, name: string, position: Vec3, rotation: Quat): ModuleInstance => ({
    id,
    kind: 'granny',
    name,
    color: DEFAULT_SQUARE,
    params: { rounds },
    position,
    rotation,
    scale: 1,
    bend: reach * 0.55,
    form: 'wall',
  });
  const strapLength = reach * Math.PI * 0.72;
  const rows = Math.max(18, Math.round(strapLength / 0.46));
  const strap: ModuleInstance = {
    id: 'strap',
    kind: 'strap',
    name: '带子',
    color: DEFAULT_STRAP,
    params: { width: 3, rows, span: reach * 2, rise: reach * 0.58 },
    position: [0, lift + reach * 2, 0],
    rotation: quatFromAxisAngle([0, 1, 0], 0),
    scale: 1,
    bend: 0,
    form: 'arch',
  };
  const modules = [
    square('front', '正面', [0, lift, reach], yaw(0)),
    square('right', '右侧', [reach, lift, 0], yaw(90)),
    square('back', '背面', [0, lift, -reach], yaw(180)),
    square('left', '左侧', [-reach, lift, 0], yaw(-90)),
    strap,
  ];
  const piece: Piece = { id: 'bag', name: '四方小袋', modules, seams: [], gather: true };
  piece.seams = autoSeams(piece).filter((seam) => {
    const a = piece.modules.find((mod) => mod.id === seam.a.moduleId);
    const b = piece.modules.find((mod) => mod.id === seam.b.moduleId);
    return a?.kind === 'granny' && b?.kind === 'granny';
  });
  piece.seams.push(
    { id: 'strap-left', a: { moduleId: 'strap', edge: 'start' }, b: { moduleId: 'left', edge: 'n' } },
    { id: 'strap-right', a: { moduleId: 'strap', edge: 'end' }, b: { moduleId: 'right', edge: 'n' } },
  );
  // The strap is a handle, not a full-edge seam. Drop those two if the counts differ;
  // they are attachments and checked separately as corner joins of width 3.
  piece.seams = piece.seams.filter((seam) => seam.a.moduleId !== 'strap');
  attachStrap(piece);
  return piece;
}

function attachStrap(piece: Piece) {
  const strap = piece.modules.find((mod) => mod.id === 'strap');
  const left = piece.modules.find((mod) => mod.id === 'left');
  const right = piece.modules.find((mod) => mod.id === 'right');
  if (!strap || !left || !right) return;
  const leftTop = worldEdge(left, 'n');
  const rightTop = worldEdge(right, 'n');
  if (!leftTop || !rightTop) return;
  strap.position = lerp(leftTop.center, rightTop.center, 0.5);
  strap.position = [strap.position[0], Math.max(leftTop.center[1], rightTop.center[1]), strap.position[2]];
}

export function coasterPreset(): Piece {
  const rounds = 4;
  const graph = buildGranny(rounds);
  const mod: ModuleInstance = {
    id: 'coaster',
    kind: 'granny',
    name: '杯垫',
    color: '#c4624a',
    params: { rounds },
    position: [0, -graph.min[2] + 0.05, 0],
    rotation: quatFromAxisAngle([1, 0, 0], -Math.PI / 2),
    scale: 1,
    bend: 0,
    form: 'flat',
  };
  return { id: 'coaster', name: '祖母方格杯垫', modules: [mod], seams: [] };
}

export function amigurumiPreset(): Piece {
  const head: ModuleInstance = {
    id: 'head',
    kind: 'sphere',
    name: '圆头',
    color: '#f0d3b0',
    params: {},
    position: [0, 2.35, 0],
    rotation: [0, 0, 0, 1],
    scale: 1,
    bend: 0,
    form: 'flat',
  };
  const ear = (id: string, x: number): ModuleInstance => ({
    id,
    kind: 'ear',
    name: id === 'ear-l' ? '左耳' : '右耳',
    color: '#e7b7ae',
    params: { rounds: 3 },
    position: [x, 3.5, 0],
    rotation: quatFromAxisAngle([0, 0, 1], x < 0 ? 0.4 : -0.4),
    scale: 1,
    bend: 0,
    form: 'flat',
  });
  return {
    id: 'head',
    name: '圆头与耳朵',
    modules: [head, ear('ear-l', -2.1), ear('ear-r', 2.1)],
    seams: [
      { id: 'ear-l', a: { moduleId: 'ear-l', edge: 'base' }, b: { moduleId: 'head', edge: 'left' } },
      { id: 'ear-r', a: { moduleId: 'ear-r', edge: 'base' }, b: { moduleId: 'head', edge: 'right' } },
    ],
  };
}

export function autoSeams(piece: Piece): Seam[] {
  const seams: Seam[] = [];
  const items: { moduleId: string; edge: EdgeId; center: Vec3; count: number; tangent: Vec3 }[] = [];
  for (const mod of piece.modules) {
    if (mod.form === 'arch') continue;
    for (const edge of moduleGraph(mod).edges) {
      const world = worldEdge(mod, edge.id);
      if (!world) continue;
      const tangent = norm(quatRotate(mod.rotation, edge.tangent));
      items.push({ moduleId: mod.id, edge: edge.id, center: world.center, count: world.count, tangent });
    }
  }
  const used = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.moduleId === b.moduleId) continue;
      if (dist(a.center, b.center) > 1.6) continue;
      if (Math.abs(dot(a.tangent, b.tangent)) < 0.72) continue;
      const keyA = `${a.moduleId}:${a.edge}`;
      const keyB = `${b.moduleId}:${b.edge}`;
      if (used.has(keyA) || used.has(keyB)) continue;
      used.add(keyA);
      used.add(keyB);
      seams.push({
        id: `${a.moduleId}-${a.edge}-${b.moduleId}-${b.edge}`,
        a: { moduleId: a.moduleId, edge: a.edge },
        b: { moduleId: b.moduleId, edge: b.edge },
      });
    }
  }
  return seams;
}

export function seamIssues(piece: Piece): SeamIssue[] {
  const issues: SeamIssue[] = [];
  for (const seam of piece.seams) {
    const a = piece.modules.find((mod) => mod.id === seam.a.moduleId);
    const b = piece.modules.find((mod) => mod.id === seam.b.moduleId);
    if (!a || !b) continue;
    const ea = edgeOf(moduleGraph(a), seam.a.edge);
    const eb = edgeOf(moduleGraph(b), seam.b.edge);
    if (!ea || !eb || ea.count === eb.count) continue;
    const proposal = propose(a, b, ea, eb);
    const nameA = a.name;
    const nameB = b.name;
    issues.push({
      seamId: seam.id,
      moduleId: proposal?.moduleId ?? a.id,
      edge: seam.a.edge,
      countA: ea.count,
      countB: eb.count,
      message: `${nameA}这一边是 ${ea.count} 针，${nameB}那一边是 ${eb.count} 针。直接缝会起皱。`,
      proposal,
    });
  }
  return issues;
}

function propose(a: ModuleInstance, b: ModuleInstance, ea: Edge, eb: Edge): SeamIssue['proposal'] {
  if (a.kind === 'granny' && b.kind === 'granny') {
    const smaller = ea.count <= eb.count ? a : b;
    const larger = smaller === a ? b : a;
    const rounds = larger.params.rounds ?? 4;
    if ((smaller.params.rounds ?? 4) !== rounds) return { moduleId: smaller.id, rounds };
  }
  const strap = a.kind === 'strap' ? a : b.kind === 'strap' ? b : null;
  if (strap) {
    const other = strap === a ? eb.count : ea.count;
    if (other !== (strap.params.width ?? 0) && other <= 8) return { moduleId: strap.id, width: other };
  }
  return null;
}

export function withPreview(piece: Piece, issue: SeamIssue): Piece {
  if (!issue.proposal) return piece;
  return {
    ...piece,
    modules: piece.modules.map((mod) => {
      if (mod.id !== issue.proposal?.moduleId) return mod;
      return {
        ...mod,
        params: {
          ...mod.params,
          rounds: issue.proposal.rounds ?? mod.params.rounds,
          width: issue.proposal.width ?? mod.params.width,
        },
      };
    }),
  };
}

export function snapModule(moving: ModuleInstance, edgeId: EdgeId, target: ModuleInstance, targetEdge: EdgeId): ModuleInstance {
  const local = edgeOf(moduleGraph(moving), edgeId);
  const remote = edgeOf(moduleGraph(target), targetEdge);
  if (!local || !remote) return moving;
  const remoteCenter = modulePoint(target, remote.center);
  const remoteTangent = norm(quatRotate(target.rotation, remote.tangent));
  const remoteOut = norm(quatRotate(target.rotation, remote.outward));
  const y = norm(sub([0, 1, 0], scale(remoteTangent, dot([0, 1, 0], remoteTangent))));
  const x = remoteTangent;
  const z = scale(remoteOut, -1);
  const world = quatFromBasis(x, lenSafe(y), z);
  const localX = local.tangent;
  const localY = norm(sub([0, 1, 0], scale(localX, dot([0, 1, 0], localX))));
  const localZ = local.outward;
  const localQ = quatFromBasis(localX, lenSafe(localY), localZ);
  const rotation = quatMulMissing(world, quatConj(localQ));
  const rotatedCenter = quatRotate(rotation, scale(local.center, moving.scale));
  const position = sub(remoteCenter, rotatedCenter);
  return { ...moving, rotation, position };
}

function lenSafe(v: Vec3): Vec3 {
  const n = norm(v);
  return n;
}

function quatConj(q: Quat): Quat {
  return [-q[0], -q[1], -q[2], q[3]];
}

function quatMulMissing(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  const q: Quat = [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
  const l = Math.hypot(...q);
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

export function newModule(kind: ModuleKind, index: number): ModuleInstance {
  const names: Record<ModuleKind, string> = {
    chain: '锁针带',
    round: '圆片',
    granny: '方格',
    sphere: '圆球',
    ear: '耳朵',
    strap: '带子',
  };
  const params = kind === 'chain' ? { stitches: 18 } : kind === 'round' ? { rounds: 5 } : kind === 'granny' ? { rounds: 4 } : kind === 'ear' ? { rounds: 3 } : kind === 'strap' ? { width: 3, rows: 24 } : {};
  return {
    id: `${kind}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    name: names[kind],
    color: kind === 'strap' ? DEFAULT_STRAP : DEFAULT_SQUARE,
    params,
    position: [index * 0.4, kind === 'sphere' ? 2.4 : 0.2, 0],
    rotation: kind === 'round' || kind === 'granny' ? quatFromAxisAngle([1, 0, 0], -Math.PI / 2) : [0, 0, 0, 1],
    scale: 1,
    bend: 0,
    form: 'flat',
  };
}

export function seamPolyline(piece: Piece, seam: Seam): Vec3[] {
  const a = piece.modules.find((mod) => mod.id === seam.a.moduleId);
  const b = piece.modules.find((mod) => mod.id === seam.b.moduleId);
  if (!a || !b) return [];
  const ea = worldEdge(a, seam.a.edge);
  const eb = worldEdge(b, seam.b.edge);
  if (!ea || !eb) return [];
  const n = Math.min(ea.points.length, eb.points.length);
  const pts: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const pa = ea.points[Math.floor((i / Math.max(1, n - 1)) * (ea.points.length - 1))];
    const pb = eb.points[Math.floor((i / Math.max(1, n - 1)) * (eb.points.length - 1))];
    pts.push(pa, lerp(pa, pb, 0.5), pb);
  }
  return pts;
}

export function floorPolyline(piece: Piece): Vec3[] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let found = false;
  for (const mod of piece.modules) {
    if (mod.form !== 'wall') continue;
    const edge = worldEdge(mod, 's');
    if (!edge) continue;
    found = true;
    for (const p of edge.points) {
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minZ = Math.min(minZ, p[2]);
      maxZ = Math.max(maxZ, p[2]);
    }
  }
  if (!found || maxX - minX < 0.4 || maxZ - minZ < 0.4) return [];
  const pad = 0.28;
  const x0 = minX + pad;
  const x1 = maxX - pad;
  const z0 = minZ + pad;
  const z1 = maxZ - pad;
  const rows = Math.max(8, Math.round((z1 - z0) / 0.24));
  const pts: Vec3[] = [];
  for (let i = 0; i <= rows; i++) {
    const z = z0 + ((z1 - z0) * i) / rows;
    const a: Vec3 = [x0, 0.05, z];
    const b: Vec3 = [x1, 0.05, z];
    pts.push(...(i % 2 === 0 ? [a, b] : [b, a]));
  }
  return pts;
}

export function pieceBounds(piece: Piece): { center: Vec3; radius: number } {
  const points: Vec3[] = [];
  for (const mod of piece.modules) {
    const graph = moduleGraph(mod);
    points.push(modulePoint(mod, graph.min), modulePoint(mod, graph.max), modulePoint(mod, graph.center));
  }
  if (!points.length) return { center: [0, 1, 0], radius: 4 };
  let min: Vec3 = [...points[0]];
  let max: Vec3 = [...points[0]];
  for (const p of points) {
    min = [Math.min(min[0], p[0]), Math.min(min[1], p[1]), Math.min(min[2], p[2])];
    max = [Math.max(max[0], p[0]), Math.max(max[1], p[1]), Math.max(max[2], p[2])];
  }
  const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const radius = Math.max(dist(center, min), dist(center, max), 2);
  return { center, radius };
}

export function strapArch(mod: ModuleInstance, p: Vec3, span: number, rise: number): Vec3 {
  const graph = moduleGraph(mod);
  const length = Math.max(0.001, graph.max[0] - graph.min[0]);
  const t = clamp((p[0] - graph.min[0]) / length, 0, 1);
  const a = (t - 0.5) * Math.PI;
  const cx = Math.sin(a) * (span / 2);
  const cy = Math.cos(a) * rise;
  const widthDir = norm([-Math.sin(a), -Math.cos(a), 0]);
  return add([cx, cy, 0], add(scale(widthDir, p[1]), [0, 0, p[2]]));
}
