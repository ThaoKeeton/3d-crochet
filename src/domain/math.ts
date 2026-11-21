export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export const UP: Vec3 = [0, 1, 0];

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function mulAdd(a: Vec3, b: Vec3, s: number): Vec3 {
  return [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
}

export function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function len(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

export function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function norm(a: Vec3): Vec3 {
  const l = len(a);
  if (l < 1e-8) return [0, 1, 0];
  return [a[0] / l, a[1] / l, a[2] / l];
}

export function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

export function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

export function mirrorX(p: Vec3): Vec3 {
  return [-p[0], p[1], p[2]];
}

export function quatIdentity(): Quat {
  return [0, 0, 0, 1];
}

export function quatNormalize(q: Quat): Quat {
  const l = Math.hypot(q[0], q[1], q[2], q[3]);
  if (l < 1e-8) return quatIdentity();
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

export function quatMul(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return quatNormalize([
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]);
}

export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const h = angle / 2;
  const s = Math.sin(h);
  const n = norm(axis);
  return [n[0] * s, n[1] * s, n[2] * s, Math.cos(h)];
}

export function quatConjugate(q: Quat): Quat {
  return [-q[0], -q[1], -q[2], q[3]];
}

export function quatRotate(q: Quat, v: Vec3): Vec3 {
  const [x, y, z] = v;
  const [qx, qy, qz, qw] = q;
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  return [
    x + qw * tx + (qy * tz - qz * ty),
    y + qw * ty + (qz * tx - qx * tz),
    z + qw * tz + (qx * ty - qy * tx),
  ];
}

/** Columns are the local axes expressed in world space. */
export function quatFromBasis(x: Vec3, y: Vec3, z: Vec3): Quat {
  const m00 = x[0];
  const m01 = y[0];
  const m02 = z[0];
  const m10 = x[1];
  const m11 = y[1];
  const m12 = z[1];
  const m20 = x[2];
  const m21 = y[2];
  const m22 = z[2];
  const trace = m00 + m11 + m22;
  let qx: number;
  let qy: number;
  let qz: number;
  let qw: number;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    qw = 0.25 * s;
    qx = (m21 - m12) / s;
    qy = (m02 - m20) / s;
    qz = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    qw = (m21 - m12) / s;
    qx = 0.25 * s;
    qy = (m01 + m10) / s;
    qz = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    qw = (m02 - m20) / s;
    qx = (m01 + m10) / s;
    qy = 0.25 * s;
    qz = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    qw = (m10 - m01) / s;
    qx = (m02 + m20) / s;
    qy = (m12 + m21) / s;
    qz = 0.25 * s;
  }
  return quatNormalize([qx, qy, qz, qw]);
}

export function transformPoint(p: Vec3, position: Vec3, rotation: Quat, s = 1): Vec3 {
  return add(position, quatRotate(rotation, scale(p, s)));
}

export function yawQuat(degrees: number): Quat {
  return quatFromAxisAngle(UP, (degrees * Math.PI) / 180);
}

export function polylineLength(points: Vec3[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total;
}

export function resample(points: Vec3[], spacing: number): Vec3[] {
  if (points.length === 0) return [];
  const out: Vec3[] = [points[0]];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a0 = points[i - 1];
    const b = points[i];
    const remain = dist(a0, b);
    if (remain < 1e-8) continue;
    let traveled = 0;
    while (carry + (remain - traveled) >= spacing) {
      const need = spacing - carry;
      const t = (traveled + need) / remain;
      out.push(lerp(a0, b, t));
      traveled += need;
      carry = 0;
    }
    carry += remain - traveled;
  }
  const end = points[points.length - 1];
  if (dist(out[out.length - 1], end) > 1e-4) out.push(end);
  return out;
}
