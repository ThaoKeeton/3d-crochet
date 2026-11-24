import type { Quat, Vec3 } from './math';

export type StitchKind = 'ch' | 'slst' | 'sc' | 'hdc' | 'dc' | 'dec' | 'ring';

export type Beat = 'insert' | 'insert2' | 'wrap' | 'wrap2' | 'pull' | 'pull2' | 'loop' | 'finish' | 'finish2' | 'travel';

export type EdgeId = 'n' | 'e' | 's' | 'w' | 'start' | 'end' | 'rim' | 'base' | 'left' | 'right';

export interface Sample {
  p: Vec3;
  beat: Beat;
  stitchId: string;
  ring?: boolean;
  ringCenter?: Vec3;
}

export interface SpaceNode {
  id: string;
  round: number;
  kind: 'ring' | 'corner' | 'side';
  at: Vec3;
}

export interface Stitch {
  id: string;
  kind: StitchKind;
  round: number;
  index: number;
  into: string[];
  sampleStart: number;
  sampleEnd: number;
  insertion: Vec3 | null;
  insertion2: Vec3 | null;
  loop: Vec3;
  edge: EdgeId | null;
}

export interface Edge {
  id: EdgeId;
  count: number;
  points: Vec3[];
  center: Vec3;
  tangent: Vec3;
  outward: Vec3;
}

export interface Graph {
  id: string;
  samples: Sample[];
  stitches: Stitch[];
  spaces: SpaceNode[];
  edges: Edge[];
  lengthCm: number;
  center: Vec3;
  size: Vec3;
  min: Vec3;
  max: Vec3;
}

export interface TeachStep {
  id: string;
  stitchId: string;
  stitchIndex: number;
  stitchTotal: number;
  kind: StitchKind;
  beat: Beat;
  title: string;
  body: string;
  loops: number;
  /** 0–1 along the whole yarn. */
  draw: number;
  hi: [number, number];
  done: [number, number] | null;
  insertion: Vec3 | null;
  loop: Vec3;
  focus: Vec3;
  hookTip: Vec3;
  hookDir: Vec3;
  showWrap: boolean;
  closeRing: number;
}

export type ModuleKind = 'chain' | 'round' | 'granny' | 'sphere' | 'ear' | 'strap';

export interface ModuleParams {
  rounds?: number;
  stitches?: number;
  rows?: number;
  width?: number;
  span?: number;
  rise?: number;
}

export interface ModuleInstance {
  id: string;
  kind: ModuleKind;
  name: string;
  color: string;
  params: ModuleParams;
  position: Vec3;
  rotation: Quat;
  scale: number;
  /** Pulls the middle of the bottom inward. Corners stay put so seams can meet. */
  bend: number;
  form: 'flat' | 'wall' | 'arch';
}

export interface SeamRef {
  moduleId: string;
  edge: EdgeId;
}

export interface Seam {
  id: string;
  a: SeamRef;
  b: SeamRef;
}

export interface Piece {
  id: string;
  name: string;
  modules: ModuleInstance[];
  seams: Seam[];
  gather?: boolean;
}

export type Hand = 'right' | 'left';

export type WeightId = 'fine' | 'sport' | 'worsted' | 'bulky';

export interface YarnNote {
  id: string;
  name: string;
  color: string;
  weight: WeightId;
  meters: string;
  note: string;
}

export interface Colorway {
  id: string;
  name: string;
  colors: string[];
}

export interface Settings {
  hand: Hand;
  speed: number;
  reduceMotion: boolean;
  hintSeen: boolean;
  aiBase?: string;
  aiModel?: string;
  aiKey?: string;
}
