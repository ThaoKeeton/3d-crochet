import * as THREE from 'three';
import { dist, lerp, type Vec3 } from '@/domain/math';

export interface YarnPoint {
  p: Vec3;
  along: number;
}

const UP = new THREE.Vector3(0, 1, 0);

export function yarnGeometry(points: YarnPoint[], radius: number, radial: number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const rough = lengthOf(points);
  let spacing = radial >= 16 ? 0.038 : 0.07;
  if (rough / spacing > 5200) spacing = rough / 5200;
  const cleaned = smoothCenterline(points, Math.max(0.03, spacing));
  if (cleaned.length < 2) return geo;
  const n = cleaned.length;
  const frames = transport(cleaned.map((item) => item.p));
  const rings = n * radial;
  const positions = new Float32Array((rings + 2) * 3);
  const normals = new Float32Array((rings + 2) * 3);
  const uvs = new Float32Array((rings + 2) * 2);
  const along = new Float32Array(rings + 2);
  const arc: number[] = [0];
  for (let i = 1; i < n; i++) arc.push(arc[i - 1] + dist(cleaned[i - 1].p, cleaned[i].p));
  const center = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const p = cleaned[i];
    center.set(p.p[0], p.p[1], p.p[2]);
    normal.copy(frames[i].normal);
    binormal.copy(frames[i].binormal);
    const rr = radius * (1 + 0.018 * Math.sin(arc[i] * 3.1));
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      vertex.copy(center).addScaledVector(normal, ca * rr).addScaledVector(binormal, sa * rr);
      const o = (i * radial + j) * 3;
      positions[o] = vertex.x;
      positions[o + 1] = vertex.y;
      positions[o + 2] = vertex.z;
      normals[o] = ca * normal.x + sa * binormal.x;
      normals[o + 1] = ca * normal.y + sa * binormal.y;
      normals[o + 2] = ca * normal.z + sa * binormal.z;
      const uv = (i * radial + j) * 2;
      uvs[uv] = arc[i] * 1.15;
      uvs[uv + 1] = j / radial;
      along[i * radial + j] = p.along;
    }
  }
  const capA = rings;
  const capB = rings + 1;
  positions[capA * 3] = cleaned[0].p[0];
  positions[capA * 3 + 1] = cleaned[0].p[1];
  positions[capA * 3 + 2] = cleaned[0].p[2];
  positions[capB * 3] = cleaned[n - 1].p[0];
  positions[capB * 3 + 1] = cleaned[n - 1].p[1];
  positions[capB * 3 + 2] = cleaned[n - 1].p[2];
  along[capA] = cleaned[0].along;
  along[capB] = cleaned[n - 1].along;
  const index: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + ((j + 1) % radial);
      index.push(a, c, b, b, c, d);
    }
  }
  for (let j = 0; j < radial; j++) {
    const a = j;
    const b = (j + 1) % radial;
    index.push(capA, b, a);
    const c = (n - 1) * radial + j;
    const d = (n - 1) * radial + ((j + 1) % radial);
    index.push(capB, c, d);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

export function graphPoints(samples: { p: Vec3 }[]): YarnPoint[] {
  const denom = Math.max(1, samples.length - 1);
  return samples.map((sample, index) => ({ p: sample.p, along: index / denom }));
}

function lengthOf(points: YarnPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1].p, points[i].p);
  return total;
}

function catmull(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const t2 = t * t;
  const t3 = t2 * t;
  const x = (c: 0 | 1 | 2) =>
    0.5 *
    (2 * p1[c] +
      (-p0[c] + p2[c]) * t +
      (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 +
      (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3);
  return [x(0), x(1), x(2)];
}

function smoothCenterline(points: YarnPoint[], spacing: number): YarnPoint[] {
  if (points.length < 2) return points;
  const out: YarnPoint[] = [];
  const n = points.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n - 1, i + 2)];
    const steps = Math.max(1, Math.ceil(dist(p1.p, p2.p) / spacing));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push({ p: catmull(p0.p, p1.p, p2.p, p3.p, t), along: p1.along + (p2.along - p1.along) * t });
    }
  }
  out.push(points[n - 1]);
  return out.length > 1 ? out : points;
}

function transport(points: Vec3[]): { tangent: THREE.Vector3; normal: THREE.Vector3; binormal: THREE.Vector3 }[] {
  const tangents: THREE.Vector3[] = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const tangent = new THREE.Vector3(next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]);
    if (tangent.lengthSq() < 1e-8) tangent.set(1, 0, 0);
    else tangent.normalize();
    tangents.push(tangent);
  }
  const normal = new THREE.Vector3().crossVectors(tangents[0], UP);
  if (normal.lengthSq() < 1e-6) normal.crossVectors(tangents[0], new THREE.Vector3(1, 0, 0));
  normal.normalize();
  const frames = [];
  for (let i = 0; i < points.length; i++) {
    const tangent = tangents[i];
    normal.addScaledVector(tangent, -normal.dot(tangent));
    if (normal.lengthSq() < 1e-6) {
      normal.crossVectors(tangent, UP);
      if (normal.lengthSq() < 1e-6) normal.crossVectors(tangent, new THREE.Vector3(1, 0, 0));
    }
    normal.normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
    frames.push({ tangent, normal: normal.clone(), binormal });
  }
  return frames;
}

export function sampleCurve(from: Vec3, control: Vec3, to: Vec3, count = 18): YarnPoint[] {
  const raw: Vec3[] = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const a = lerp(from, control, t);
    const b = lerp(control, to, t);
    raw.push(lerp(a, b, t));
  }
  return raw.map((p, index) => ({ p, along: index / count }));
}
