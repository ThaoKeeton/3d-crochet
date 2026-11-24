import { ContactShadows, Environment, Lightformer, OrbitControls, PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { add, dist, lerp as lerpVec, norm, scale, transformPoint, type Vec3 } from '@/domain/math';
import { bendPoint, floorPolyline, moduleGraph, seamPolyline, strapArch } from '@/domain/piece';
import { hookEyePose, overviewPose } from '@/domain/teach';
import type { TriangleMesh } from '@/domain/mesh';
import type { Graph, Piece, TeachStep } from '@/domain/types';
import { useApp } from '@/state/store';
import { patchPresence } from '@/ui/presence';
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
  | { kind: 'compose'; piece: Piece; selected: string | null }
  | { kind: 'sculpt'; parts: TriangleMesh[]; colors: Record<string, string>; view: 'mesh' | 'yarn'; yarns: { id: string; color: string; graph: Graph }[]; selected: string | null; sizeCm: number; yarnMm: number };

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
  const goalColor = useRef(new THREE.Color(color));
  useEffect(() => {
    goalColor.current.set(color);
    material.emissive.set(selected ? '#5a2e24' : '#000000');
    material.emissiveIntensity = selected ? 0.18 : 0;
  }, [color, material, selected]);
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-Math.min(0.05, dt) * 2.2);
    material.color.lerp(goalColor.current, k);
  });
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
  const shown = useMemo(() => new THREE.Quaternion(), []);
  const place = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const aim = useMemo(() => new THREE.Vector3(), []);
  const group = useRef<THREE.Group>(null);
  const ready = useRef(false);
  useEffect(() => {
    return () => {
      head.dispose();
      handle.dispose();
      metal.dispose();
      wood.dispose();
    };
  }, [head, handle, metal, wood]);
  useFrame(({ clock }, dt) => {
    if (!group.current) return;
    const { tip, dir } = pose.current;
    aim.set(dir[0], dir[1], dir[2]);
    if (aim.lengthSq() < 1e-6) aim.set(0, 1, 0);
    else aim.normalize();
    quaternion.setFromUnitVectors(up, aim);
    const breathe = Math.sin(clock.elapsedTime * 1.5) * 0.014;
    place.set(tip[0], tip[1] + breathe, tip[2]);
    const k = 1 - Math.exp(-Math.min(0.05, dt) * 9);
    if (!ready.current) {
      group.current.position.copy(place);
      shown.copy(quaternion);
      ready.current = true;
    } else {
      group.current.position.lerp(place, k);
      shown.slerp(quaternion, k);
    }
    group.current.quaternion.copy(shown);
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
  const handGroup = useRef<THREE.Group>(null);
  const handNow = useRef(hand);
  const insertRef = useRef<THREE.Mesh>(null);
  const loopRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const pulse = settings.reduceMotion ? 1 : 1 + Math.sin(clock.elapsedTime * 3.2) * 0.08;
    handNow.current += (hand - handNow.current) * (settings.reduceMotion ? 1 : 0.08);
    if (handGroup.current) handGroup.current.scale.x = handNow.current;
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
    pose.current.dir = lerpVec(prev.hookDir, curr.hookDir, k);
    pose.current.focus = lerpVec(prev.focus, curr.focus, k);
    pose.current.showWrap = curr.showWrap;
    const showInsert = (curr.beat === 'insert' || curr.beat === 'insert2') && k > 0.35 && curr.insertion;
    if (insertRef.current) {
      insertRef.current.visible = !!showInsert;
      insertRef.current.scale.setScalar(showInsert ? pulse : 0.001);
      if (curr.insertion) insertRef.current.position.set(curr.insertion[0], curr.insertion[1], curr.insertion[2]);
    }
    const showLoop = curr.beat !== 'travel';
    const loopAt = lerpVec(prev.loop, curr.loop, k);
    if (loopRef.current) {
      loopRef.current.visible = showLoop;
      loopRef.current.scale.setScalar(showLoop ? pulse : 0.001);
      loopRef.current.position.set(loopAt[0], loopAt[1], loopAt[2]);
    }
  });

  return (
    <>
      {world.kind === 'compose' ? (
        <ComposeBody piece={world.piece} selected={world.selected} radial={radial} radius={radius} onSelect={setSelected} onMove={moveModule} />
      ) : world.kind === 'sculpt' ? (
        <SculptBody world={world} radial={radial} />
      ) : (
        <group ref={handGroup}>
          <SingleBody world={world} radial={radial} radius={radius} uniforms={uniforms} />
          {world.kind === 'teach' && (
            <>
              <HookMesh pose={pose} />
              <YarnBall position={[world.graph.min[0] - 1.15, 0.5, 0.12]} color={world.color} />
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

function SculptBody({ world, radial }: { world: Extract<World, { kind: 'sculpt' }>; radial: number }) {
  const { setSelected } = useApp();
  if (world.view === 'yarn') {
    return (
      <group>
        {world.yarns.map((yarn) => (
          <YarnMesh key={yarn.id} points={graphPoints(yarn.graph.samples)} color={yarn.color} radius={Math.max(0.08, world.yarnMm / 20)} radial={Math.max(8, radial - 4)} />
        ))}
      </group>
    );
  }
  return (
    <group scale={world.sizeCm}>
      {world.parts.map((part) => (
        <SculptPart key={part.id} part={part} color={world.colors[part.id] || '#c4624a'} selected={world.selected === part.id} onPick={() => setSelected(part.id)} />
      ))}
    </group>
  );
}

function SculptPart({ part, color, selected, onPick }: { part: TriangleMesh; color: string; selected: boolean; onPick: () => void }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(part.positions, 3));
    geo.setIndex(new THREE.BufferAttribute(part.indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, [part]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      onClick={(event) => {
        event.stopPropagation();
        onPick();
      }}
    >
      <meshStandardMaterial color={color} roughness={0.62} metalness={0.02} emissive={selected ? '#5a2e24' : '#000000'} emissiveIntensity={selected ? 0.22 : 0} />
    </mesh>
  );
}

function SingleBody({
  world,
  radial,
  radius,
  uniforms,
}: {
  world: Exclude<World, { kind: 'compose' | 'sculpt' }>;
  radial: number;
  radius: number;
  uniforms: YarnUniforms;
}) {
  const points = useMemo(() => graphPoints(world.graph.samples), [world.graph]);
  const lift = world.spin < -0.4 ? 0.22 : -world.graph.min[1] + 0.02;
  const sway = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!sway.current) return;
    const t = clock.elapsedTime;
    if (world.kind === 'still') sway.current.rotation.y = Math.sin(t * 0.38) * 0.2;
    else if (world.kind === 'teach') sway.current.rotation.z = Math.sin(t * 0.7) * 0.008;
    else sway.current.rotation.z = Math.sin(t * 0.5) * 0.004;
  });
  return (
    <group ref={sway} position={[0, lift, 0]} rotation={[world.spin, 0, 0]}>
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
        return (
          <Appear key={seam.id}>
            <YarnMesh points={points} color={issues.has(seam.id) ? '#a33b32' : '#d7b48a'} radius={radius * 0.72} radial={Math.max(5, radial - 2)} />
          </Appear>
        );
      })}
      {piece.gather && (
        <YarnMesh
          points={floorPolyline(piece).map((p, index, all) => ({ p, along: index / Math.max(1, all.length - 1) }))}
          color={piece.modules.find((mod) => mod.form === 'wall')?.color ?? '#e08a4f'}
          radius={radius * 1.15}
          radial={8}
        />
      )}
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
  const shapeKey = `v4:${mod.kind}:${mod.form}:${mod.bend}:${mod.params.rounds ?? ''}:${mod.params.rows ?? ''}:${mod.params.width ?? ''}:${mod.params.stitches ?? ''}:${mod.params.span ?? ''}:${mod.params.rise ?? ''}`;
  const points = shapeCache.get(shapeKey) ?? shapedModule(mod);
  if (!shapeCache.has(shapeKey)) shapeCache.set(shapeKey, points);
  const graph = moduleGraph(mod);
  const dragging = useRef(false);
  const quaternion = useMemo(() => new THREE.Quaternion(mod.rotation[0], mod.rotation[1], mod.rotation[2], mod.rotation[3]), [mod.rotation]);
  const size = Math.max(graph.size[0], graph.size[1], graph.size[2], 1.2);
  return (
    <SoftPlace position={mod.position} rotation={quaternion} scale={mod.scale}>
      <YarnMesh points={points} color={mod.color} radius={mod.kind === 'granny' ? radius * 1.05 : radius} radial={radial} selected={selected} />
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
    </SoftPlace>
  );
}

function SoftPlace({
  position,
  rotation,
  scale: targetScale,
  children,
}: {
  position: Vec3;
  rotation: THREE.Quaternion;
  scale: number;
  children: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3(position[0], position[1] + 0.65, position[2]));
  const goal = useRef(new THREE.Vector3());
  const shown = useRef(rotation.clone());
  const scl = useRef(targetScale * 0.96);
  useFrame((_, dt) => {
    const group = ref.current;
    if (!group) return;
    const k = 1 - Math.exp(-Math.min(0.05, dt) * 5.2);
    goal.current.set(position[0], position[1], position[2]);
    pos.current.lerp(goal.current, k);
    shown.current.slerp(rotation, k);
    scl.current += (targetScale - scl.current) * k;
    group.position.copy(pos.current);
    group.quaternion.copy(shown.current);
    group.scale.setScalar(scl.current);
  });
  return <group ref={ref}>{children}</group>;
}

function Appear({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const scl = useRef(0.15);
  useFrame((_, dt) => {
    const group = ref.current;
    if (!group) return;
    const k = 1 - Math.exp(-Math.min(0.05, dt) * 4.5);
    scl.current += (1 - scl.current) * k;
    group.scale.setScalar(scl.current);
  });
  return <group ref={ref}>{children}</group>;
}

function onSphere(radius: number, lat: number, lon: number): Vec3 {
  return [Math.cos(lon) * Math.cos(lat) * radius, Math.sin(lat) * radius, Math.sin(lon) * Math.cos(lat) * radius];
}

function woundBall(radius: number): YarnPoint[] {
  const pts: Vec3[] = [];
  const bands = 8;
  for (let b = 0; b < bands; b++) {
    const lat = ((b + 0.5) / bands - 0.5) * Math.PI * 0.86;
    const phase = b * 0.55;
    if (pts.length) {
      const prev = pts[pts.length - 1];
      const next = onSphere(radius, lat, phase);
      for (let s = 1; s <= 4; s++) pts.push(lerpVec(prev, next, s / 4));
    }
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const a = phase + (i / n) * Math.PI * 2;
      const wobble = radius * (1 + 0.03 * Math.sin(a * 3 + b));
      pts.push(onSphere(wobble, lat, a));
    }
  }
  const turns = 5;
  const steps = turns * 32;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = (t - 0.5) * Math.PI * 0.9;
    const lon = t * turns * Math.PI * 2 + 1.2;
    const next = onSphere(radius * 1.04, lat, lon);
    if (i === 0 && pts.length) {
      const prev = pts[pts.length - 1];
      for (let s = 1; s <= 3; s++) pts.push(lerpVec(prev, next, s / 3));
    }
    pts.push(next);
  }
  return pts.map((p, index) => ({ p, along: index / Math.max(1, pts.length - 1) }));
}

function YarnBall({ position, color }: { position: Vec3; color: string }) {
  const windings = useMemo(() => [woundBall(0.5)], []);
  const tail = useMemo<YarnPoint[]>(
    () =>
      (
        [
          [0.02, 0.46, 0.04],
          [0.32, 0.2, 0.12],
          [0.7, 0.06, 0.08],
          [1.12, 0.02, 0.0],
          [1.5, 0.08, -0.02],
        ] as Vec3[]
      ).map((p, index, all) => ({ p, along: index / (all.length - 1) })),
    [],
  );
  return (
    <group position={position}>
      {windings.map((points, index) => (
        <YarnMesh key={index} points={points} color={color} radius={0.078} radial={8} />
      ))}
      <YarnMesh points={tail} color={color} radius={0.13} radial={10} />
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

function sculptBounds(world: Extract<World, { kind: 'sculpt' }>): { center: Vec3; size: number } {
  if (world.view === 'yarn' && world.yarns.length) {
    let min: Vec3 = [Infinity, Infinity, Infinity];
    let max: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const yarn of world.yarns) {
      min = [Math.min(min[0], yarn.graph.min[0]), Math.min(min[1], yarn.graph.min[1]), Math.min(min[2], yarn.graph.min[2])];
      max = [Math.max(max[0], yarn.graph.max[0]), Math.max(max[1], yarn.graph.max[1]), Math.max(max[2], yarn.graph.max[2])];
    }
    const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    return { center, size: Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 4) };
  }
  const center: Vec3 = [0, world.sizeCm * 0.5, 0];
  return { center, size: world.sizeCm };
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

function CameraRig() {
  const { world, cameraMode, settings } = useApp();
  const { camera, controls, size } = useThree();
  const goalPos = useRef(new THREE.Vector3(14, 9, 18));
  const goalTgt = useRef(new THREE.Vector3(0, 2.2, 0));
  const signature = useRef('');
  const userOwned = useRef(false);
  const dragging = useRef(false);
  useEffect(() => {
    const ctl = controls as { addEventListener?: (type: string, cb: () => void) => void; removeEventListener?: (type: string, cb: () => void) => void } | null;
    if (!ctl?.addEventListener) return;
    const start = () => {
      dragging.current = true;
      userOwned.current = true;
      patchPresence({ orbiting: true });
    };
    const end = () => {
      dragging.current = false;
      patchPresence({ orbiting: false });
    };
    ctl.addEventListener('start', start);
    ctl.addEventListener('end', end);
    return () => {
      ctl.removeEventListener?.('start', start);
      ctl.removeEventListener?.('end', end);
      patchPresence({ orbiting: false });
    };
  }, [controls]);

  useFrame((_, dt) => {
    const step = world.kind === 'teach' ? world.play.current.index : -1;
    const sculptKey = world.kind === 'sculpt' ? `${world.view}:${world.sizeCm}:${world.parts.length}` : '';
    const id = `${world.kind}:${cameraMode}:${step}:${settings.hand}:${sculptKey}`;
    if (signature.current !== id) {
      signature.current = id;
      userOwned.current = false;
    }
    const pose = desiredPose(world, cameraMode);
    const wide = size.width >= 980;
    const nudge = wide ? Math.min(3.2, size.width * 0.0016) : 0;
    goalPos.current.set(pose.position[0] + nudge, pose.position[1], pose.position[2]);
    goalTgt.current.set(pose.target[0] + nudge, pose.target[1] - (wide ? 0 : 0.8), pose.target[2]);
    if (dragging.current || userOwned.current) return;
    const ctl = controls as { target?: THREE.Vector3; update?: () => void } | null;
    const gap = camera.position.distanceTo(goalPos.current);
    const rate = gap > 6 ? 8 : 3.4;
    let k = settings.reduceMotion ? 1 : 1 - Math.exp(-Math.min(0.05, dt) * rate);
    if (!settings.reduceMotion && gap > 12) k = Math.max(k, 0.62);
    camera.position.lerp(goalPos.current, k);
    if (ctl?.target) ctl.target.lerp(goalTgt.current, k);
    camera.lookAt(ctl?.target ?? goalTgt.current);
    ctl?.update?.();
  });
  return null;
}

function desiredPose(world: World, mode: CameraMode): { position: Vec3; target: Vec3; focus: Vec3 } {
  if (world.kind === 'sculpt') {
    const box = sculptBounds(world);
    const posed = overviewPose(box.center, Math.max(box.size, 4) * 1.85);
    const pull = mode === 'hook' ? 0.62 : mode === 'follow' ? 0.8 : 1;
    return { position: lerpVec(posed.target, posed.camera, pull), target: posed.target, focus: posed.target };
  }
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
  const chainStrip = step.kind === 'ch' && graph.size[0] > graph.size[1] * 1.6;
  const formed: Vec3 = [step.focus[0] - 1.45, step.focus[1], step.focus[2]];
  const anchor = chainStrip ? lerpVec(mid, formed, step.stitchIndex <= 4 ? 0.46 : 0.18) : mid;
  const span = dist(step.hookTip, step.focus) + (chainStrip && step.stitchIndex <= 4 ? 3.6 : mode === 'hook' ? 2.4 : 2.6);
  const posed = overviewPose([anchor[0], anchor[1] + 0.4, anchor[2]], Math.max(mode === 'hook' ? 2.8 : 3.1, span * 0.82));
  if (mode === 'hook') {
    const eye = hookEyePose(mid, step.hookDir);
    return { position: eye.camera, target: mid, focus: mid };
  }
  return { position: posed.camera, target: anchor, focus: anchor };
}

function Studio() {
  const [quality, setQuality] = useState<'high' | 'low'>('high');
  const { settings } = useApp();
  const map = useMemo(() => linenTexture(), []);
  const keyLight = useRef<THREE.DirectionalLight>(null);
  useEffect(() => () => map?.dispose(), [map]);
  useFrame(({ clock }) => {
    const light = keyLight.current;
    if (!light || settings.reduceMotion) return;
    const base = quality === 'high' ? 1.7 : 1.45;
    light.intensity = base + Math.sin(clock.elapsedTime * 0.7) * 0.07;
  });
  return (
    <>
      <PerformanceMonitor flipflops={2} onDecline={() => setQuality('low')} onIncline={() => setQuality('high')} />
      <color attach="background" args={['#e7dccb']} />
      <fog attach="fog" args={['#e7dccb', 48, 120]} />
      <hemisphereLight args={['#fff6ea', '#e6d3ba', 0.62]} />
      <directionalLight
        ref={(light) => {
          keyLight.current = light;
        }}
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
      <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.14} rotateSpeed={0.62} zoomSpeed={0.7} minDistance={1.2} maxDistance={48} minPolarAngle={0.15} maxPolarAngle={Math.PI * 0.49} />
    </>
  );
}

export function StageCanvas() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.6]}
      camera={{ fov: 32, position: [14, 9, 18], near: 0.05, far: 80 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      onCreated={({ gl, camera }) => {
        camera.lookAt(0, 2.2, 0);
        gl.setClearColor('#e7dccb');
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.96;
      }}
    >
      <Studio />
    </Canvas>
  );
}
