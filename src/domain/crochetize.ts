import { GraphBuilder } from './builder';
import { normalizeMeshes, scaleMeshes, type TriangleMesh } from './mesh';
import type { Graph } from './types';

export interface CrochetRound {
  partId: string;
  partName: string;
  round: number;
  count: number;
  color: string;
  line: string;
}

export interface CrochetPlan {
  rounds: CrochetRound[];
  graphs: { id: string; name: string; color: string; graph: Graph }[];
  pattern: string;
  lengthCm: number;
  teachGraph: Graph;
  teachColor: string;
}

const PRIMARY_AXIS = 1;

export function crochetize(parts: TriangleMesh[], colors: Record<string, string>, sizeCm: number, yarnMm: number): CrochetPlan {
  const sized = scaleMeshes(normalizeMeshes(parts), sizeCm);
  const pitch = Math.max(0.28, (yarnMm / 10) * 1.25);
  const rowH = Math.max(0.24, (yarnMm / 10) * 0.95);
  const rounds: CrochetRound[] = [];
  const graphs: CrochetPlan['graphs'] = [];
  for (const part of sized) {
    const color = colors[part.id] || '#c4624a';
    const raw = sliceCounts(part, pitch, rowH);
    const counts = smoothCounts(raw);
    let previous: number | null = null;
    counts.forEach((count, index) => {
      const line = describeRound(previous, count, index === 0);
      rounds.push({ partId: part.id, partName: part.name, round: index + 1, count, color, line });
      previous = count;
    });
    const graph = graphFor(part, counts, pitch, rowH);
    graphs.push({ id: part.id, name: part.name, color, graph });
  }
  const lengthCm = graphs.reduce((sum, item) => sum + item.graph.lengthCm, 0);
  const main = graphs.slice().sort((a, b) => b.graph.lengthCm - a.graph.lengthCm)[0];
  const pattern = writePattern(parts, rounds, sizeCm, yarnMm, lengthCm);
  return {
    rounds,
    graphs,
    pattern,
    lengthCm,
    teachGraph: main?.graph ?? graphs[0].graph,
    teachColor: main?.color ?? '#c4624a',
  };
}

function sliceCounts(part: TriangleMesh, pitch: number, rowH: number): number[] {
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < part.positions.length; i += 3) {
    minY = Math.min(minY, part.positions[i]);
    maxY = Math.max(maxY, part.positions[i]);
  }
  const span = Math.max(rowH, maxY - minY);
  const rows = Math.max(4, Math.min(32, Math.round(span / rowH)));
  const counts: number[] = [];
  for (let row = 0; row < rows; row++) {
    const y = minY + ((row + 0.5) / rows) * span;
    const perimeter = sectionPerimeter(part, y);
    const count = Math.max(6, Math.min(72, Math.round(perimeter / pitch)));
    counts.push(count);
  }
  return counts;
}

function sectionPerimeter(part: TriangleMesh, y: number): number {
  let length = 0;
  const p = part.positions;
  const idx = part.indices;
  for (let t = 0; t < idx.length; t += 3) {
    const ys = [p[idx[t] * 3 + PRIMARY_AXIS], p[idx[t + 1] * 3 + PRIMARY_AXIS], p[idx[t + 2] * 3 + PRIMARY_AXIS]];
    const above = ys.map((value) => value >= y);
    if (above[0] === above[1] && above[1] === above[2]) continue;
    const hits: number[] = [];
    for (let e = 0; e < 3; e++) {
      const n = (e + 1) % 3;
      if (above[e] === above[n]) continue;
      const denom = ys[n] - ys[e] || 1e-6;
      const tEdge = (y - ys[e]) / denom;
      const ia = idx[t + e] * 3;
      const ib = idx[t + n] * 3;
      hits.push(p[ia] + (p[ib] - p[ia]) * tEdge, p[ia + 2] + (p[ib + 2] - p[ia + 2]) * tEdge);
    }
    if (hits.length >= 4) {
      const dx = hits[2] - hits[0];
      const dz = hits[3] - hits[1];
      length += Math.hypot(dx, dz);
    }
  }
  return length;
}

export function smoothCounts(raw: number[]): number[] {
  if (!raw.length) return [6];
  const out = [Math.max(6, Math.min(raw[0], 8))];
  for (let i = 1; i < raw.length; i++) {
    const prev = out[i - 1];
    const cap = Math.max(2, Math.round(prev * 0.34));
    const target = Math.max(6, raw[i]);
    const delta = Math.max(-cap, Math.min(cap, target - prev));
    out.push(Math.max(6, prev + delta));
  }
  return out;
}

function describeRound(previous: number | null, count: number, first: boolean): string {
  if (first || previous == null) return `魔法环起 ${count} 针短针`;
  const delta = count - previous;
  if (delta === 0) return `${count} 短针，不加不减`;
  if (delta > 0 && count === previous * 2) return `每针加 1 针，共 ${count} 针`;
  if (delta > 0) return `均匀加 ${delta} 针，共 ${count} 针`;
  if (previous === count * 2) return `两针并一针，共 ${count} 针`;
  return `均匀减 ${-delta} 针，共 ${count} 针`;
}

function graphFor(part: TriangleMesh, counts: number[], pitch: number, rowH: number): Graph {
  let minY = Infinity;
  for (let i = 1; i < part.positions.length; i += 3) minY = Math.min(minY, part.positions[i]);
  const builder = new GraphBuilder();
  counts.forEach((count, round) => {
    const radius = Math.max(0.18, (count * pitch) / (Math.PI * 2));
    const y = minY + round * rowH + rowH * 0.5;
    const cx = centroid(part, 0);
    const cz = centroid(part, 2);
    const points: [number, number, number][] = [];
    const steps = count;
    for (let s = 0; s <= steps; s++) {
      const angle = (s / steps) * Math.PI * 2;
      const wobble = 1 + 0.04 * Math.sin(s * 3);
      points.push([cx + Math.cos(angle) * radius * wobble, y, cz + Math.sin(angle) * radius * wobble]);
    }
    builder.stitch({
      kind: 'sc',
      round,
      parts: [{ beat: round === 0 ? 'insert' : 'loop', points }],
    });
  });
  return builder.finish(`yarn-${part.id}`);
}

function centroid(part: TriangleMesh, axis: 0 | 2): number {
  let sum = 0;
  let n = 0;
  for (let i = axis; i < part.positions.length; i += 3) {
    sum += part.positions[i];
    n += 1;
  }
  return n ? sum / n : 0;
}

function writePattern(parts: TriangleMesh[], rounds: CrochetRound[], sizeCm: number, yarnMm: number, lengthCm: number): string {
  const lines = [`成品约 ${sizeCm.toFixed(0)} cm 高，线径 ${yarnMm.toFixed(1)} mm。`, `短针圈织。每一圈的加减针不超过上一圈的三分之一，所以可以直接钩。`, ''];
  let lastPart = '';
  for (const round of rounds) {
    if (round.partId !== lastPart) {
      lines.push(`${round.partName} · ${round.color}`);
      lastPart = round.partId;
    }
    lines.push(`圈 ${round.round}  ${round.line}`);
  }
  lines.push('', '缝合');
  const names = parts.map((part) => part.name);
  if (names.length > 1) lines.push(`把${names.slice(1).join('、')}缝到${names[0]}上。挂环缝在最高处，线头藏进织物里。`);
  else lines.push('收针后把线头藏进织物。');
  lines.push(`线长大约 ${Math.round(lengthCm)} cm，含少量线头。`);
  return lines.join('\n');
}
