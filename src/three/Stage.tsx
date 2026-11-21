import { ContactShadows, Environment, Lightformer, OrbitControls, PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { add, dist, lerp as lerpVec, norm, scale, transformPoint, type Vec3 } from '@/domain/math';
import { bendPoint, gatherPolyline, moduleGraph, seamPolyline, strapArch } from '@/domain/piece';
import { hookEyePose, overviewPose } from '@/domain/teach';
import type { Graph, Piece, TeachStep } from '@/domain/types';
import { useApp } from '@/state/store';
import { createYarnMaterial, hookMetal, hookWood, type YarnUniforms } from './materials';
import { graphPoints, yarnGeometry, type YarnPoint } from './yarnGeometry';

export type CameraMode = 'follow' | 'hook' | 'overview';

export interface PlaySnap {
  index: number;
  t: number;
  reduce: boolean;
}

export type World =
  | { kind: 'still'; graph: Graph; color: string; spin: number; hook: boolean }
  | { kind: 'teach'; graph: Graph; color: string; steps: TeachStep[]; play: { current: PlaySnap }; spin: number }
  | { kind: 'make'; graph: Graph; color: string; draw: number; spin: number }
  | { kind: 'compose'; piece: Piece; selected: string | null };

function linenTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#eadcc8';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 512; i += 2) {
    ctx.strokeStyle = i % 4 === 0 ? 'rgba(120, 86, 54, 0.08)' : 'rgba(255, 248, 236, 0.16)';
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + Math.sin(i) * 0.6, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i + Math.cos(i) * 0.6);
    ctx.stroke();
  }
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = `rgba(90, 60, 40, ${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 7);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function YarnMesh({
  points,
  color,
  radius,
  radial,
  uniforms,
  selected = false,
}: {
  points: YarnPoint[];
  color: string;
  radius: number;
  radial: number;
  uniforms?: YarnUniforms;
  selected?: boolean;
}) {
  const geometry = useMemo(() => yarnGeometry(points, radius, radial), [points, radius, radial]);
  const material = useMemo(() => createYarnMaterial(color, uniforms), [color, uniforms]);
  useEffect(() => {
    material.color.set(color);
    material.emissive.set(selected ? '#5a2e24' : '#000000');
    material.emissiveIntensity = selected ? 0.18 : 0;
  }, [color, material, selected]);
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);
  if (!points.length) return null;
  return <mesh geometry={geometry} material={material} receiveShadow />;
}

function HookMesh({ pose, scale = 1 }: { pose: { current: { tip: Vec3; dir: Vec3 } }; scale?: number }) {
  const head = useMemo(() => hookCurve(0, 0.78, 28), []);
  const handle = useMemo(() => hookCurve(0.78, 2.15, 22), []);
  const metal = useMemo(() => hookMetal(), []);
  const wood = useMemo(() => hookWood(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const aim = useMemo(() => new THREE.Vector3(), []);
  const group = useRef<THREE.Group>(null);
  useEffect(() => {
    return () => {
      head.dispose();
      handle.dispose();
      metal.dispose();
      wood.dispose();
    };
  }, [head, handle, metal, wood]);
  useFrame(() => {
    if (!group.current) return;
    const { tip, dir } = pose.current;
    aim.set(dir[0], dir[1], dir[2]);
    if (aim.lengthSq() < 1e-6) aim.set(0, 1, 0);
    else aim.normalize();
    quaternion.setFromUnitVectors(up, aim);
    group.current.quaternion.copy(quaternion);
    group.current.position.set(tip[0], tip[1], tip[2]);
  });
  return (
    <group ref={group} scale={scale}>
      <mesh geometry={head} material={metal} castShadow />
      <mesh geometry={handle} material={wood} castShadow />
    </group>
  );
}

function hookCurve(from: number, to: number, steps: number) {
  const pts: THREE.Vector3[] = [];
  const radii: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = from + ((to - from) * i) / steps;
    const y = t * 1.55;
    const bend = t < 0.42 ? Math.sin(t / 0.42 * Math.PI) : 0;
    pts.push(new THREE.Vector3(-bend * 0.22 + (t < 0.18 ? (0.18 - t) * 0.35 : 0), y, bend * 0.04));
    const shaft = 0.045 + t * 0.01;
    const belly = t < 0.28 ? 0.05 + t * 0.22 : Math.max(shaft, 0.07);
    radii.push(t > 1.15 ? 0.07 + Math.sin((t - 1.15) * 2.2) * 0.018 : belly);
  }
  return variableTube(pts, radii, 22);
}

function variableTube(points: THREE.Vector3[], radii: number[], radial: number) {
  const geo = new THREE.BufferGeometry();
  const n = points.length;
  const positions: number[] = [];
  const normals: number[] = [];
  const index: number[] = [];
  let normal = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i < n; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(n - 1, i + 1)];
    const tangent = next.clone().sub(prev).normalize();
    normal.addScaledVector(tangent, -normal.dot(tangent));
    if (normal.lengthSq() < 1e-6) normal = new THREE.Vector3(1, 0, 0);
    normal.normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const offset = normal.clone().multiplyScalar(Math.cos(a) * radii[i]).add(binormal.clone().multiplyScalar(Math.sin(a) * radii[i]));
      positions.push(points[i].x + offset.x, points[i].y + offset.y, points[i].z + offset.z);
      normals.push(offset.x, offset.y, offset.z);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + ((j + 1) % radial);
      index.push(a, c, b, b, c, d);
    }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(index);
  geo.normalizeNormals();
  return geo;
}

const shapeCache = new Map<string, YarnPoint[]>();

function shapedModule(mod: Piece['modules'][number]) {
  const graph = moduleGraph(mod);
  if (mod.form === 'wall') {
    return graph.samples.map((sample, index) => ({ p: bendPoint(mod, sample.p), along: index / Math.max(1, graph.samples.length - 1) }));
  }
  if (mod.form === 'arch') {
    const span = mod.params.span ?? 8;
    const rise = mod.params.rise ?? 3;
    return graph.samples.map((sample, index) => ({
      p: strapArch(mod, sample.p, span, rise),
      along: index / Math.max(1, graph.samples.length - 1),
    }));
  }
  return graphPoints(graph.samples);
}

function Craft({ quality }: { quality: 'high' | 'low' }) {
  const { world, settings, setSelected, moveModule } = useApp();
  const radial = quality === 'high' ? 18 : 12;
  const radius = 0.155;
  const hand = settings.hand === 'left' ? -1 : 1;
  const uniforms = useMemo<YarnUniforms>(
    () => ({
      uDraw: { value: 1 },
      uHiA: { value: -1 },
      uHiB: { value: -1 },
      uDoneA: { value: -1 },
      uDoneB: { value: -1 },
      uHi: { value: new THREE.Color('#fff1d4') },
    }),
    [],
  );
  const pose = useRef({ tip: [0, 0.4, 0] as Vec3, dir: [0.4, 0.8, 0.3] as Vec3, focus: [0, 0.4, 0] as Vec3, showWrap: false });
  const insertRef = useRef<THREE.Mesh>(null);
  const loopRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const pulse = settings.reduceMotion ? 1 : 1 + Math.sin(clock.elapsedTime * 3.2) * 0.08;
    if (world.kind !== 'teach') {
      uniforms.uDraw.value = world.kind === 'make' ? world.draw : 1;
      uniforms.uHiA.value = -1;
      uniforms.uHiB.value = -1;
      uniforms.uDoneA.value = -1;
      uniforms.uDoneB.value = -1;
      if (insertRef.current) insertRef.current.visible = false;
      if (loopRef.current) loopRef.current.visible = false;
      return;
    }
    const { index, t, reduce } = world.play.current;
    const steps = world.steps;
    const curr = steps[Math.min(steps.length - 1, Math.max(0, index))];
    const prev = steps[Math.max(0, index - 1)] ?? curr;
    if (!curr) return;
    const k = reduce ? 1 : t * t * (3 - 2 * t);
    uniforms.uDraw.value = prev.draw + (curr.draw - prev.draw) * k;
    uniforms.uHiA.value = curr.hi[0];
    uniforms.uHiB.value = curr.hi[1];
    uniforms.uDoneA.value = curr.done?.[0] ?? -1;
    uniforms.uDoneB.value = curr.done?.[1] ?? -1;
    pose.current.tip = lerpVec(prev.hookTip, curr.hookTip, k);
    pose.current.dir = curr.hookDir;
    pose.current.focus = lerpVec(prev.focus, curr.focus, k);
    pose.current.showWrap = curr.showWrap;
    const showInsert = (curr.beat === 'insert' || curr.beat === 'insert2') && k > 0.35 && curr.insertion;
    if (insertRef.current) {
      insertRef.current.visible = !!showInsert;
      insertRef.current.scale.setScalar(showInsert ? pulse : 0.001);
      if (curr.insertion) insertRef.current.position.set(curr.insertion[0], curr.insertion[1], curr.insertion[2]);
    }
    const showLoop = curr.beat !== 'travel';
    if (loopRef.current) {
      loopRef.current.visible = showLoop;
      loopRef.current.scale.setScalar(showLoop ? pulse : 0.001);
      loopRef.current.position.set(curr.loop[0], curr.loop[1], curr.loop[2]);
    }
  });

  return (
    <>
      {world.kind === 'compose' ? (
        <ComposeBody piece={world.piece} selected={world.selected} radial={radial} radius={radius} onSelect={setSelected} onMove={moveModule} />
      ) : (
        <group scale={[hand, 1, 1]}>
          <SingleBody world={world} radial={radial} radius={radius} uniforms={uniforms} />
          {world.kind === 'teach' && (
            <>
              <HookMesh pose={pose} />
              <YarnBall position={[world.graph.min[0] - 1.6, 0.62, -0.4]} color={world.color} />
              <mesh ref={insertRef} visible={false}>
                <torusGeometry args={[0.18, 0.03, 8, 28]} />
                <meshStandardMaterial color="#fff4df" emissive="#fff4df" emissiveIntensity={0.5} side={THREE.DoubleSide} />
              </mesh>
              <mesh ref={loopRef} visible={false}>
                <torusGeometry args={[0.14, 0.026, 8, 24]} />
                <meshStandardMaterial color={world.color} emissive="#fff1d4" emissiveIntensity={0.35} side={THREE.DoubleSide} />
              </mesh>
            </>
          )}
        </group>
      )}
    </>
  );
}

function SingleBody({
  world,
  radial,
  radius,
  uniforms,
}: {
  world: Exclude<World, { kind: 'compose' }>;
  radial: number;
  radius: number;
  uniforms: YarnUniforms;
}) {
  const points = useMemo(() => graphPoints(world.graph.samples), [world.graph]);
  const lift = world.spin < -0.4 ? 0.22 : -world.graph.min[1] + 0.02;
  return (
    <group position={[0, lift, 0]} rotation={[world.spin, 0, 0]}>
      <YarnMesh points={points} color={world.color} radius={radius} radial={radial} uniforms={uniforms} />
      {world.kind === 'still' && world.hook && <StillHook graph={world.graph} />}
    </group>
  );
}

function ComposeBody({
  piece,
  selected,
  radial,
  radius,
  onSelect,
  onMove,
}: {
  piece: Piece;
  selected: string | null;
  radial: number;
  radius: number;
  onSelect: (id: string | null) => void;
  onMove: (id: string, position: Vec3) => void;
}) {
  const issues = new Set(
    piece.seams
      .filter((seam) => {
        const a = piece.modules.find((mod) => mod.id === seam.a.moduleId);
        const b = piece.modules.find((mod) => mod.id === seam.b.moduleId);
        if (!a || !b) return false;
        const ea = moduleGraph(a).edges.find((edge) => edge.id === seam.a.edge);
        const eb = moduleGraph(b).edges.find((edge) => edge.id === seam.b.edge);
        return !!ea && !!eb && ea.count !== eb.count;
      })
      .map((seam) => seam.id),
  );
  return (
    <group
      onPointerMissed={() => {
        onSelect(null);
      }}
    >
      {piece.modules.map((mod) => (
        <ModuleView key={mod.id} mod={mod} selected={mod.id === selected} radial={radial} radius={radius} onSelect={onSelect} onMove={onMove} />
      ))}
      {piece.seams.map((seam) => {
        const points = seamPolyline(piece, seam).map((p, index, all) => ({ p, along: index / Math.max(1, all.length - 1) }));
        return <YarnMesh key={seam.id} points={points} color={issues.has(seam.id) ? '#a33b32' : '#d7b48a'} radius={radius * 0.72} radial={Math.max(5, radial - 2)} />;
      })}
      {piece.gather &&
        piece.modules
          .filter((mod) => mod.form === 'wall')
          .map((mod) => {
            const points = gatherPolyline(mod).map((p, index, all) => ({ p, along: index / Math.max(1, all.length - 1) }));
            return <YarnMesh key={`g-${mod.id}`} points={points} color="#e4c9a4" radius={radius * 0.55} radial={5} />;
          })}
    </group>
  );
}

function ModuleView({
  mod,
  selected,
  radial,
  radius,
  onSelect,
  onMove,
}: {
  mod: Piece['modules'][number];
  selected: boolean;
  radial: number;
  radius: number;
  onSelect: (id: string) => void;
  onMove: (id: string, position: Vec3) => void;
}) {
  const shapeKey = `${mod.kind}:${mod.form}:${mod.bend}:${mod.params.rounds ?? ''}:${mod.params.rows ?? ''}:${mod.params.width ?? ''}:${mod.params.stitches ?? ''}:${mod.params.span ?? ''}:${mod.params.rise ?? ''}`;
  const points = shapeCache.get(shapeKey) ?? shapedModule(mod);
  if (!shapeCache.has(shapeKey)) shapeCache.set(shapeKey, points);
  const graph = moduleGraph(mod);
  const dragging = useRef(false);
  const quaternion = useMemo(() => new THREE.Quaternion(mod.rotation[0], mod.rotation[1], mod.rotation[2], mod.rotation[3]), [mod.rotation]);
  const size = Math.max(graph.size[0], graph.size[1], graph.size[2], 1.2);
  return (
    <group position={mod.position} quaternion={quaternion} scale={mod.scale}>
      <YarnMesh points={points} color={mod.color} radius={radius} radial={radial} selected={selected} />
      <mesh
        visible={false}
        onPointerDown={(event) => {
          event.stopPropagation();
          dragging.current = true;
          onSelect(mod.id);
        }}
        onPointerMove={(event) => {
          if (!dragging.current) return;
          const local = event.point;
          const next: Vec3 = [local.x, mod.form === 'wall' || mod.kind === 'sphere' ? mod.position[1] : Math.max(0.05, local.y), local.z];
          onMove(mod.id, next);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
      >
        <boxGeometry args={[size, Math.max(size, 0.8), Math.max(graph.size[2], 0.8)]} />
      </mesh>
    </group>
  );
}

function YarnBall({ position, color }: { position: Vec3; color: string }) {
  const material = useMemo(() => createYarnMaterial(color), [color]);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <group position={position}>
      <mesh material={material} castShadow>
        <sphereGeometry args={[0.52, 24, 16]} />
      </mesh>
      <mesh material={material} rotation={[0.5, 0.2, 0.4]} castShadow>
        <torusGeometry args={[0.42, 0.1, 8, 24]} />
      </mesh>
      <mesh material={material} rotation={[1.1, 0.8, 0.2]} castShadow>
        <torusGeometry args={[0.36, 0.09, 8, 20]} />
      </mesh>
    </group>
  );
}

function stillHold(graph: Graph): { tip: Vec3; dir: Vec3 } {
  const last = graph.samples[graph.samples.length - 1]?.p ?? [0, 0.7, 0];
  const dir = norm([0.42, 0.82, 0.38]);
  return {
    tip: [last[0] - 0.05, last[1] + 0.02, last[2] + 0.28],
    dir,
  };
}

function StillHook({ graph }: { graph: Graph }) {
  const pose = useMemo(() => ({ current: stillHold(graph) }), [graph]);
  const loop = graph.samples[graph.samples.length - 1]?.p ?? [0, 0.7, 0];
  return (
    <>
      <HookMesh pose={pose} scale={1.2} />
      <mesh position={loop}>
        <torusGeometry args={[0.2, 0.03, 12, 32]} />
        <meshStandardMaterial color="#fff6e8" emissive="#fff6e8" emissiveIntensity={0.55} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

function framePoints(points: Vec3[], margin: number): { position: Vec3; target: Vec3; focus: Vec3 } {
  if (!points.length) return { position: [8, 6, 11], target: [0, 2, 0], focus: [0, 2, 0] };
  let min: Vec3 = [...points[0]];
  let max: Vec3 = [...points[0]];
  for (const p of points) {
    min = [Math.min(min[0], p[0]), Math.min(min[1], p[1]), Math.min(min[2], p[2])];
    max = [Math.max(max[0], p[0]), Math.max(max[1], p[1]), Math.max(max[2], p[2])];
  }
  const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const radius = Math.max(dist(center, min), dist(center, max), 1.8);
  const distance = (radius / Math.tan((17 * Math.PI) / 180)) * margin;
  const position = add(center, scale(norm([0.72, 0.5, 1]), distance));
  return { position, target: center, focus: center };
}

function pieceFrame(piece: Piece, moduleId: string | null, margin: number) {
  const mods = moduleId ? piece.modules.filter((mod) => mod.id === moduleId) : piece.modules;
  const use = mods.length ? mods : piece.modules;
  const world: Vec3[] = [];
  for (const mod of use) {
    const pts = shapedModule(mod);
    const step = Math.max(1, Math.floor(pts.length / 48));
    for (let i = 0; i < pts.length; i += step) {
      world.push(transformPoint(pts[i].p, mod.position, mod.rotation, mod.scale));
    }
  }
  return framePoints(world, margin);
}

function placeCamera(camera: THREE.Camera, controls: unknown, position: Vec3, target: Vec3) {
  const ctl = controls as { target?: THREE.Vector3; update?: () => void } | null;
  camera.position.set(position[0], position[1], position[2]);
  if (ctl?.target) ctl.target.set(target[0], target[1], target[2]);
  camera.lookAt(target[0], target[1], target[2]);
  ctl?.update?.();
}

function CameraRig() {
  const { world, cameraMode, settings } = useApp();
  const { camera, controls } = useThree();
  const key = useRef('');
  const stepKey = useRef(-1);
  const dragging = useRef(false);
  useEffect(() => {
    const ctl = controls as { addEventListener?: (type: string, cb: () => void) => void; removeEventListener?: (type: string, cb: () => void) => void } | null;
    if (!ctl?.addEventListener) return;
    const start = () => {
      dragging.current = true;
    };
    const end = () => {
      dragging.current = false;
    };
    ctl.addEventListener('start', start);
    ctl.addEventListener('end', end);
    return () => {
      ctl.removeEventListener?.('start', start);
      ctl.removeEventListener?.('end', end);
    };
  }, [controls]);

  useEffect(() => {
    if (dragging.current) return;
    const pose = desiredPose(world, cameraMode);
    const id = `${world.kind}:${cameraMode}:${pose.position.join()}:${pose.target.join()}`;
    if (key.current === id) return;
    key.current = id;
    placeCamera(camera, controls, pose.position, pose.target);
    stepKey.current = world.kind === 'teach' ? world.play.current.index : -1;
  }, [world, cameraMode, camera, controls, settings.reduceMotion]);
  useFrame(() => {
    if (world.kind !== 'teach' || dragging.current) return;
    const index = world.play.current.index;
    if (stepKey.current === index) return;
    stepKey.current = index;
    const pose = desiredPose(world, cameraMode);
    placeCamera(camera, controls, pose.position, pose.target);
  });
  return null;
}

function desiredPose(world: World, mode: CameraMode): { position: Vec3; target: Vec3; focus: Vec3 } {
  if (world.kind === 'compose') {
    const wide: { position: Vec3; target: Vec3; focus: Vec3 } =
      world.piece.modules.some((mod) => mod.form === 'wall')
        ? { position: [27, 18, 31], target: [0, 5.2, 0], focus: [0, 5.2, 0] }
        : pieceFrame(world.piece, null, 1.5);
    const pull = mode === 'hook' ? 0.58 : mode === 'follow' ? 0.76 : 1;
    return {
      position: lerpVec(wide.target, wide.position, pull),
      target: wide.target,
      focus: wide.focus,
    };
  }
  const graph = world.graph;
  const lift = world.spin < -0.4 ? 0.22 : -graph.min[1] + 0.02;
  const center: Vec3 = [graph.center[0], graph.center[1] + lift, graph.center[2]];
  const overview = overviewPose(center, Math.max(graph.size[0], graph.size[1] + (world.kind === 'still' ? 1.6 : 0), 3.2));
  if (mode === 'overview' || world.kind !== 'teach') {
    if (world.kind === 'still' && world.hook) {
      const hold = stillHold(graph);
      const target: Vec3 = [center[0] * 0.58 + hold.tip[0] * 0.42, center[1] + 0.2, center[2]];
      const posed = overviewPose(target, Math.max(graph.size[0] * 0.9, 6.2));
      return { position: posed.camera, target: posed.target, focus: hold.tip };
    }
    return { position: overview.camera, target: overview.target, focus: overview.target };
  }
  const step = world.steps[Math.max(0, world.play.current.index)] ?? world.steps[0];
  if (!step) return { position: overview.camera, target: overview.target, focus: overview.target };
  const mid = lerpVec(step.hookTip, step.focus, mode === 'hook' ? 0.32 : 0.45);
  const span = dist(step.hookTip, step.focus) + (mode === 'hook' ? 1.8 : 2.2);
  const posed = overviewPose([mid[0], mid[1] + 0.35, mid[2]], Math.max(mode === 'hook' ? 2.1 : 2.5, span * 0.72));
  if (mode === 'hook') {
    const eye = hookEyePose(mid, step.hookDir);
    return { position: eye.camera, target: mid, focus: mid };
  }
  return { position: posed.camera, target: mid, focus: mid };
}

function Studio() {
  const [quality, setQuality] = useState<'high' | 'low'>('high');
  const map = useMemo(() => linenTexture(), []);
  useEffect(() => () => map?.dispose(), [map]);
  return (
    <>
      <PerformanceMonitor flipflops={2} onDecline={() => setQuality('low')} onIncline={() => setQuality('high')} />
      <color attach="background" args={['#e7dccb']} />
      <fog attach="fog" args={['#e7dccb', 48, 120]} />
      <hemisphereLight args={['#fff6ea', '#e6d3ba', 0.62]} />
      <directionalLight
        position={[4.8, 8.2, 3.4]}
        intensity={quality === 'high' ? 1.7 : 1.45}
        color="#fff4e6"
        castShadow={quality === 'high'}
        shadow-mapSize={[2048, 2048]}
        shadow-radius={10}
        shadow-camera-near={0.4}
        shadow-camera-far={22}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.00035}
      />
      <directionalLight position={[-3.5, 4.2, 3.6]} intensity={0.85} color="#fff8ef" />
      <directionalLight position={[-4.6, 2.8, -2.4]} intensity={0.28} color="#d7e6f6" />
      {quality === 'high' && (
        <Environment resolution={64} frames={1}>
          <Lightformer form="rect" intensity={1.5} color="#fff4e6" position={[0, 4.2, 2.4]} scale={[7, 3, 1]} />
          <Lightformer form="rect" intensity={0.45} color="#d5e6f6" position={[-4, 2, -2]} scale={[3, 3, 1]} />
        </Environment>
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
        <circleGeometry args={[24, 72]} />
        <meshStandardMaterial color="#e4d0b6" map={map} roughness={0.94} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <ringGeometry args={[7.2, 9.4, 64]} />
        <meshStandardMaterial color="#e7d3b8" roughness={1} />
      </mesh>
      {quality === 'high' && <ContactShadows position={[0, 0, 0]} opacity={0.42} scale={22} blur={3.4} far={7} color="#7d654c" resolution={512} />}
      <Craft quality={quality} />
      <CameraRig />
      <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.08} rotateSpeed={0.55} zoomSpeed={0.65} minDistance={1.2} maxDistance={48} minPolarAngle={0.15} maxPolarAngle={Math.PI * 0.49} />
    </>
  );
}

export function StageCanvas() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.6]}
      camera={{ fov: 32, position: [4.2, 3.4, 6.4], near: 0.05, far: 80 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      onCreated={({ gl, camera }) => {
        camera.lookAt(0, 1.2, 0);
        gl.setClearColor('#e7dccb');
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.96;
      }}
    >
      <Studio />
    </Canvas>
  );
}
