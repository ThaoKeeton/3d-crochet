import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { bagPreset } from '@/domain/piece';
import { buildChain } from '@/domain/motifs';
import type { Vec3 } from '@/domain/math';
import type { Colorway, Piece, Settings, YarnNote } from '@/domain/types';
import { DEFAULT_STRAP } from '@/domain/yarns';
import type { CameraMode, World } from '@/three/Stage';

const KEY = 'gouzhi.v1';

export type Route =
  | { name: 'learn' }
  | { name: 'lesson'; id: string }
  | { name: 'make' }
  | { name: 'project'; id: string }
  | { name: 'compose' }
  | { name: 'mine' };

interface Progress {
  lessons: Record<string, number>;
  projects: Record<string, { round: number; count: number }>;
  bagStep: number;
}

interface Save {
  settings: Settings;
  progress: Progress;
  piece: Piece;
  notes: YarnNote[];
  colorways: Colorway[];
  makeColors: Record<string, string>;
}

const fallbackPiece = () => bagPreset();

function fresh(): Save {
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    settings: { hand: 'right', speed: 1, reduceMotion: reduce, hintSeen: false },
    progress: { lessons: {}, projects: {}, bagStep: 0 },
    piece: fallbackPiece(),
    notes: [],
    colorways: [],
    makeColors: {},
  };
}

function load(): Save {
  const base = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Save>;
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...parsed.settings },
      progress: {
        lessons: parsed.progress?.lessons ?? {},
        projects: parsed.progress?.projects ?? {},
        bagStep: parsed.progress?.bagStep ?? 0,
      },
      piece: sanitizePiece(parsed.piece) ?? base.piece,
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      colorways: Array.isArray(parsed.colorways) ? parsed.colorways : [],
      makeColors: parsed.makeColors ?? {},
    };
  } catch {
    return base;
  }
}

function sanitizePiece(piece: Piece | undefined): Piece | null {
  if (!piece || !Array.isArray(piece.modules) || piece.modules.length === 0) return null;
  return {
    id: piece.id || 'piece',
    name: piece.name || '未命名',
    gather: piece.gather,
    seams: Array.isArray(piece.seams) ? piece.seams : [],
    modules: piece.modules.map((mod, index) => ({
      ...mod,
      id: mod.id || `m-${index}`,
      form: mod.form ?? 'flat',
      bend: mod.bend ?? 0,
      scale: mod.scale || 1,
      rotation: mod.rotation ?? [0, 0, 0, 1],
      position: mod.position ?? [0, 0, 0],
      params: mod.params ?? {},
      color: mod.color || '#f0d3b0',
      name: mod.name || '模块',
    })),
  };
}

function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [head, id] = parts;
  if (head === 'learn' && id) return { name: 'lesson', id };
  if (head === 'learn') return { name: 'learn' };
  if (head === 'make' && id) return { name: 'project', id };
  if (head === 'make') return { name: 'make' };
  if (head === 'compose' || head === 'p') return { name: 'compose' };
  if (head === 'mine') return { name: 'mine' };
  return { name: 'learn' };
}

function routeHash(route: Route): string {
  if (route.name === 'lesson') return `#/learn/${route.id}`;
  if (route.name === 'project') return `#/make/${route.id}`;
  if (route.name === 'make') return '#/make';
  if (route.name === 'compose') return '#/compose';
  if (route.name === 'mine') return '#/mine';
  return '#/learn';
}

export function encodePiece(piece: Piece): string {
  const bytes = new TextEncoder().encode(JSON.stringify(piece));
  let bin = '';
  bytes.forEach((byte) => {
    bin += String.fromCharCode(byte);
  });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodePiece(code: string): Piece | null {
  try {
    const padded = code.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, (char) => char.charCodeAt(0));
    return sanitizePiece(JSON.parse(new TextDecoder().decode(bytes)) as Piece);
  } catch {
    return null;
  }
}

interface AppValue extends Save {
  route: Route;
  go: (route: Route) => void;
  world: World;
  setWorld: (world: World) => void;
  cameraMode: CameraMode;
  setCameraMode: (mode: CameraMode) => void;
  selected: string | null;
  setSelected: (id: string | null) => void;
  patchSettings: (patch: Partial<Settings>) => void;
  setPiece: (piece: Piece | ((prev: Piece) => Piece)) => void;
  moveModule: (id: string, position: Vec3) => void;
  markLesson: (id: string, index: number) => void;
  markProject: (id: string, round: number, count: number) => void;
  setBagStep: (step: number) => void;
  setMakeColor: (id: string, color: string) => void;
  addNote: (note: YarnNote) => void;
  removeNote: (id: string) => void;
  saveColorway: (colorway: Colorway) => void;
  resetAll: () => void;
}

const Ctx = createContext<AppValue | null>(null);

const still = (): World => ({
  kind: 'still',
  graph: buildChain(8),
  color: DEFAULT_STRAP,
  spin: 0,
  hook: true,
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [save, setSave] = useState<Save>(() => (typeof window === 'undefined' ? fresh() : load()));
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  const [world, setWorld] = useState<World>(still);
  const [cameraMode, setCameraMode] = useState<CameraMode>('overview');
  const [selected, setSelected] = useState<string | null>('front');

  useEffect(() => {
    const shared = window.location.hash.match(/^#\/p\/([^/]+)/);
    if (!shared) return;
    const piece = decodePiece(shared[1]);
    if (piece) {
      setSave((prev) => ({ ...prev, piece }));
      setRoute({ name: 'compose' });
    }
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(save));
  }, [save]);

  const api = useMemo<AppValue>(() => {
    const go = (next: Route) => {
      const hash = routeHash(next);
      if (window.location.hash !== hash) window.location.hash = hash;
      setRoute(next);
      setCameraMode(next.name === 'lesson' ? 'follow' : 'overview');
    };
    return {
      ...save,
      route,
      go,
      world,
      setWorld,
      cameraMode,
      setCameraMode,
      selected,
      setSelected,
      patchSettings: (patch) => setSave((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } })),
      setPiece: (piece) =>
        setSave((prev) => ({ ...prev, piece: typeof piece === 'function' ? piece(prev.piece) : piece })),
      moveModule: (id, position) =>
        setSave((prev) => ({
          ...prev,
          piece: {
            ...prev.piece,
            modules: prev.piece.modules.map((mod) => (mod.id === id ? { ...mod, position } : mod)),
          },
        })),
      markLesson: (id, index) =>
        setSave((prev) => ({ ...prev, progress: { ...prev.progress, lessons: { ...prev.progress.lessons, [id]: index } } })),
      markProject: (id, round, count) =>
        setSave((prev) => ({
          ...prev,
          progress: { ...prev.progress, projects: { ...prev.progress.projects, [id]: { round, count } } },
        })),
      setBagStep: (step) => setSave((prev) => ({ ...prev, progress: { ...prev.progress, bagStep: step } })),
      setMakeColor: (id, color) => setSave((prev) => ({ ...prev, makeColors: { ...prev.makeColors, [id]: color } })),
      addNote: (note) => setSave((prev) => ({ ...prev, notes: [note, ...prev.notes] })),
      removeNote: (id) => setSave((prev) => ({ ...prev, notes: prev.notes.filter((note) => note.id !== id) })),
      saveColorway: (colorway) => setSave((prev) => ({ ...prev, colorways: [colorway, ...prev.colorways].slice(0, 12) })),
      resetAll: () => {
        localStorage.removeItem(KEY);
        setSave(fresh());
        setSelected(null);
      },
    };
  }, [save, route, world, cameraMode, selected]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useApp() {
  const value = useContext(Ctx);
  if (!value) throw new Error('AppProvider 缺失');
  return value;
}
