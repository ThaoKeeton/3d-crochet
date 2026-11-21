import * as THREE from 'three';
import { dist, lerp, type Vec3 } from '@/domain/math';

export interface YarnPoint {
  p: Vec3;
  along: number;
}

const UP = new THREE.Vector3(0, 1, 0);

export function yarnGeometry(points: YarnPoint[], radius: number, radial: number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const cleaned = thin(points, Math.max(0.08, radius * 0.85));
  if (cleaned.length < 2) return geo;
  const n = cleaned.length;
  const frames = transport(cleaned.map((item) => item.p));
  const positions = new Float32Array(n * radial * 3);
  const normals = new Float32Array(n * radial * 3);
  const uvs = new Float32Array(n * radial * 2);
  const along = new Float32Array(n * radial);
  const arc: number[] = [0];
  for (let i = 1; i < n; i++) arc.push(arc[i - 1] + dist(cleaned[i - 1].p, cleaned[i].p));
  const center = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const twistedN = new THREE.Vector3();
  const twistedB = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const p = cleaned[i];
    center.set(p.p[0], p.p[1], p.p[2]);
    normal.copy(frames[i].normal);
    binormal.copy(frames[i].binormal);
    const twist = arc[i] * 1.35;
    const c = Math.cos(twist);
    const s = Math.sin(twist);
    twistedN.copy(normal).multiplyScalar(c).addScaledVector(binormal, s);
    twistedB.copy(binormal).multiplyScalar(c).addScaledVector(normal, -s);
    const rr = radius * (1 + 0.035 * Math.sin(p.along * 17.3 + i * 0.2));
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      vertex.copy(center).addScaledVector(twistedN, ca * rr).addScaledVector(twistedB, sa * rr * 0.94);
      const o = (i * radial + j) * 3;
      positions[o] = vertex.x;
      positions[o + 1] = vertex.y;
      positions[o + 2] = vertex.z;
      normals[o] = ca * twistedN.x + sa * twistedB.x;
      normals[o + 1] = ca * twistedN.y + sa * twistedB.y;
      normals[o + 2] = ca * twistedN.z + sa * twistedB.z;
      const uv = (i * radial + j) * 2;
      uvs[uv] = arc[i] * 0.85;
      uvs[uv + 1] = j / radial;
      along[i * radial + j] = p.along;
    }
  }
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
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
  geo.setIndex(index);
  return geo;
}

export function graphPoints(samples: { p: Vec3 }[]): YarnPoint[] {
  const denom = Math.max(1, samples.length - 1);
  return samples.map((sample, index) => ({ p: sample.p, along: index / denom }));
}

function thin(points: YarnPoint[], spacing: number): YarnPoint[] {
  if (points.length < 2) return points;
  const out: YarnPoint[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    if (dist(out[out.length - 1].p, points[i].p) >= spacing) out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out;
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
