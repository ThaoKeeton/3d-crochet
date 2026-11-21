import { dist, dot, len, lerp, norm, resample, scale, sub, type Vec3 } from './math';
import type { Beat, Edge, EdgeId, Graph, Sample, SpaceNode, Stitch, StitchKind } from './types';

const SPACING = 0.11;

export interface StitchPart {
  beat: Beat;
  points: Vec3[];
}

export interface StitchInput {
  kind: StitchKind;
  round: number;
  into?: string[];
  insertion?: Vec3 | null;
  insertion2?: Vec3 | null;
  edge?: EdgeId | null;
  ringCenter?: Vec3;
  parts: StitchPart[];
}

export class GraphBuilder {
  readonly samples: Sample[] = [];
  readonly stitches: Stitch[] = [];
  readonly spaces: SpaceNode[] = [];
  private seq = 0;
  private readonly edgePoints = new Map<EdgeId, Vec3[]>();
  private readonly edgeHint = new Map<EdgeId, { tangent: Vec3; outward: Vec3 }>();

  last(): Vec3 | null {
    return this.samples.length ? this.samples[this.samples.length - 1].p : null;
  }

  hintEdge(id: EdgeId, tangent: Vec3, outward: Vec3) {
    this.edgeHint.set(id, { tangent: norm(tangent), outward: norm(outward) });
  }

  addSpace(space: SpaceNode) {
    this.spaces.push(space);
  }

  stitch(input: StitchInput): string {
    const id = `${input.kind}-${input.round}-${this.seq++}`;
    const start = this.samples.length;
    let previous = this.last();
    for (const part of input.parts) {
      const dense = resample(clean(part.points), SPACING);
      for (const p of dense) {
        if (previous && dist(previous, p) < 0.02) continue;
        this.samples.push({
          p,
          beat: part.beat,
          stitchId: id,
          ring: input.ringCenter ? true : undefined,
          ringCenter: input.ringCenter,
        });
        previous = p;
      }
    }
    if (this.samples.length === start) {
      if (this.samples.length === 0) return id;
      const end = this.samples.length - 1;
      this.stitches.push({
        id,
        kind: input.kind,
        round: input.round,
        index: this.stitches.length,
        into: input.into ?? [],
        sampleStart: end,
        sampleEnd: end,
        insertion: input.insertion ?? null,
        insertion2: input.insertion2 ?? null,
        loop: this.samples[end].p,
        edge: input.edge ?? null,
      });
      return id;
    }
    const end = this.samples.length - 1;
    const loop = this.samples[end].p;
    const insertion = input.insertion ?? null;
    this.stitches.push({
      id,
      kind: input.kind,
      round: input.round,
      index: this.stitches.length,
      into: input.into ?? [],
      sampleStart: start,
      sampleEnd: end,
      insertion,
      insertion2: input.insertion2 ?? null,
      loop,
      edge: input.edge ?? null,
    });
    if (input.edge) {
      const bucket = this.edgePoints.get(input.edge) ?? [];
      bucket.push(loop);
      this.edgePoints.set(input.edge, bucket);
    }
    return id;
  }

  finish(id: string): Graph {
    const samples = this.samples;
    if (samples.length === 0) {
      return emptyGraph(id);
    }
    let lengthCm = 0;
    let min: Vec3 = [...samples[0].p];
    let max: Vec3 = [...samples[0].p];
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i].p;
      if (i > 0) lengthCm += dist(samples[i - 1].p, p);
      min = [Math.min(min[0], p[0]), Math.min(min[1], p[1]), Math.min(min[2], p[2])];
      max = [Math.max(max[0], p[0]), Math.max(max[1], p[1]), Math.max(max[2], p[2])];
    }
    const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const size: Vec3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    const edges: Edge[] = [];
    for (const [edgeId, points] of this.edgePoints) {
      if (points.length === 0) continue;
      const hint = this.edgeHint.get(edgeId);
      const tangent = hint?.tangent ?? inferTangent(points);
      const outward = hint?.outward ?? inferOutward(points, center, tangent);
      const sorted = [...points].sort((a, b) => dot(a, tangent) - dot(b, tangent));
      const edgeCenter = lerp(sorted[0], sorted[sorted.length - 1], 0.5);
      edges.push({
        id: edgeId,
        count: points.length,
        points: sorted,
        center: edgeCenter,
        tangent,
        outward,
      });
    }
    return {
      id,
      samples,
      stitches: this.stitches,
      spaces: this.spaces,
      edges,
      lengthCm,
      center,
      size,
      min,
      max,
    };
  }
}

function clean(points: Vec3[]): Vec3[] {
  const out: Vec3[] = [];
  for (const p of points) {
    if (!out.length || dist(out[out.length - 1], p) > 1e-4) out.push(p);
  }
  return out;
}

function inferTangent(points: Vec3[]): Vec3 {
  if (points.length < 2) return [1, 0, 0];
  return norm(sub(points[points.length - 1], points[0]));
}

function inferOutward(points: Vec3[], center: Vec3, tangent: Vec3): Vec3 {
  const mid = points[Math.floor(points.length / 2)];
  const away = sub(mid, center);
  const projected = sub(away, scale(tangent, dot(away, tangent)));
  return len(projected) < 1e-4 ? [0, 0, 1] : norm(projected);
}

function emptyGraph(id: string): Graph {
  return {
    id,
    samples: [],
    stitches: [],
    spaces: [],
    edges: [],
    lengthCm: 0,
    center: [0, 0, 0],
    size: [0, 0, 0],
    min: [0, 0, 0],
    max: [0, 0, 0],
  };
}

export function edgeOf(graph: Graph, id: EdgeId): Edge | undefined {
  return graph.edges.find((edge) => edge.id === id);
}

export function mirrorGraph(graph: Graph): Graph {
  const flip = (p: Vec3): Vec3 => [-p[0], p[1], p[2]];
  const flipEdge = (id: EdgeId): EdgeId => (id === 'e' ? 'w' : id === 'w' ? 'e' : id === 'left' ? 'right' : id === 'right' ? 'left' : id);
  return {
    ...graph,
    samples: graph.samples.map((sample) => ({
      ...sample,
      p: flip(sample.p),
      ringCenter: sample.ringCenter ? flip(sample.ringCenter) : undefined,
    })),
    stitches: graph.stitches.map((stitch) => ({
      ...stitch,
      insertion: stitch.insertion ? flip(stitch.insertion) : null,
      insertion2: stitch.insertion2 ? flip(stitch.insertion2) : null,
      loop: flip(stitch.loop),
      edge: stitch.edge ? flipEdge(stitch.edge) : null,
    })),
    spaces: graph.spaces.map((space) => ({ ...space, at: flip(space.at) })),
    edges: graph.edges.map((edge) => ({
      ...edge,
      id: flipEdge(edge.id),
      points: edge.points.map(flip),
      center: flip(edge.center),
      tangent: flip(edge.tangent),
      outward: flip(edge.outward),
    })),
    center: flip(graph.center),
    min: flip(graph.max),
    max: flip(graph.min),
  };
}

export function splitByLength(points: Vec3[], cuts: { beat: Beat; until: number }[]): StitchPart[] {
  if (points.length === 0) return [];
  const lengths: number[] = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + dist(points[i - 1], points[i]));
  const total = lengths[lengths.length - 1] || 1;
  const parts: StitchPart[] = cuts.map((cut) => ({ beat: cut.beat, points: [] }));
  let partIndex = 0;
  for (let i = 0; i < points.length; i++) {
    const t = lengths[i] / total;
    while (partIndex < cuts.length - 1 && t > cuts[partIndex].until) partIndex++;
    parts[partIndex].points.push(points[i]);
  }
  return parts.filter((part) => part.points.length > 0);
}

export function add3(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  return [a[0] + b[0] + c[0], a[1] + b[1] + c[1], a[2] + b[2] + c[2]];
}
