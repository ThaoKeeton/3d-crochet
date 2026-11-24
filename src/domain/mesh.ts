export type PartRole =
  | 'body'
  | 'head'
  | 'ear'
  | 'limb'
  | 'snout'
  | 'tail'
  | 'hat'
  | 'scarf'
  | 'planet'
  | 'flame'
  | 'loop'
  | 'strap'
  | 'accent'
  | 'base'
  | 'top';

export interface TriangleMesh {
  id: string;
  name: string;
  role: PartRole;
  positions: Float32Array;
  indices: Uint32Array;
}

interface RawMesh {
  positions: number[];
  indices: number[];
}

export function uvSphere(stacks = 12, slices = 16): RawMesh {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let y = 0; y <= stacks; y++) {
    const phi = (y / stacks) * Math.PI;
    for (let x = 0; x <= slices; x++) {
      const theta = (x / slices) * Math.PI * 2;
      positions.push(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
    }
  }
  const row = slices + 1;
  for (let y = 0; y < stacks; y++) {
    for (let x = 0; x < slices; x++) {
      const a = y * row + x;
      const b = a + row;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { positions, indices };
}

export function uvTorus(radius = 1, tube = 0.18, segments = 18, sides = 8): RawMesh {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const u = (i / segments) * Math.PI * 2;
    for (let j = 0; j <= sides; j++) {
      const v = (j / sides) * Math.PI * 2;
      const cx = Math.cos(u) * radius;
      const cz = Math.sin(u) * radius;
      positions.push(cx + Math.cos(v) * Math.cos(u) * tube, Math.sin(v) * tube, cz + Math.cos(v) * Math.sin(u) * tube);
    }
  }
  const row = sides + 1;
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * row + j;
      const b = a + row;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { positions, indices };
}

export function uvCone(height = 1, radius = 0.4, slices = 14): RawMesh {
  const positions: number[] = [0, height, 0];
  const indices: number[] = [];
  for (let i = 0; i <= slices; i++) {
    const a = (i / slices) * Math.PI * 2;
    positions.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
  }
  for (let i = 1; i <= slices; i++) indices.push(0, i, i + 1);
  return { positions, indices };
}

export function place(raw: RawMesh, scale: [number, number, number], translate: [number, number, number]): RawMesh {
  const positions: number[] = [];
  for (let i = 0; i < raw.positions.length; i += 3) {
    positions.push(raw.positions[i] * scale[0] + translate[0], raw.positions[i + 1] * scale[1] + translate[1], raw.positions[i + 2] * scale[2] + translate[2]);
  }
  return { positions, indices: raw.indices.slice() };
}

export function toMesh(id: string, name: string, role: PartRole, raw: RawMesh): TriangleMesh {
  return {
    id,
    name,
    role,
    positions: Float32Array.from(raw.positions),
    indices: Uint32Array.from(raw.indices),
  };
}

export function meshBounds(parts: TriangleMesh[]): { min: [number, number, number]; max: [number, number, number] } {
  let min: [number, number, number] = [Infinity, Infinity, Infinity];
  let max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const part of parts) {
    for (let i = 0; i < part.positions.length; i += 3) {
      const x = part.positions[i];
      const y = part.positions[i + 1];
      const z = part.positions[i + 2];
      min = [Math.min(min[0], x), Math.min(min[1], y), Math.min(min[2], z)];
      max = [Math.max(max[0], x), Math.max(max[1], y), Math.max(max[2], z)];
    }
  }
  if (!Number.isFinite(min[0])) return { min: [0, 0, 0], max: [1, 1, 1] };
  return { min, max };
}

/** Sit the model on the table, centered, with height 1. */
export function normalizeMeshes(parts: TriangleMesh[]): TriangleMesh[] {
  const { min, max } = meshBounds(parts);
  const height = Math.max(0.001, max[1] - min[1]);
  const cx = (min[0] + max[0]) / 2;
  const cz = (min[2] + max[2]) / 2;
  return parts.map((part) => {
    const positions = new Float32Array(part.positions.length);
    for (let i = 0; i < part.positions.length; i += 3) {
      positions[i] = (part.positions[i] - cx) / height;
      positions[i + 1] = (part.positions[i + 1] - min[1]) / height;
      positions[i + 2] = (part.positions[i + 2] - cz) / height;
    }
    return { ...part, positions };
  });
}

export function scaleMeshes(parts: TriangleMesh[], sizeCm: number): TriangleMesh[] {
  return parts.map((part) => {
    const positions = new Float32Array(part.positions.length);
    for (let i = 0; i < positions.length; i++) positions[i] = part.positions[i] * sizeCm;
    return { ...part, positions };
  });
}

export function exportStl(parts: TriangleMesh[]): ArrayBuffer {
  let triangles = 0;
  for (const part of parts) triangles += part.indices.length / 3;
  const buffer = new ArrayBuffer(84 + triangles * 50);
  const view = new DataView(buffer);
  const header = new TextEncoder().encode('gouzhi');
  new Uint8Array(buffer, 0, 80).set(header);
  view.setUint32(80, triangles, true);
  let offset = 84;
  for (const part of parts) {
    for (let t = 0; t < part.indices.length; t += 3) {
      const a = part.indices[t] * 3;
      const b = part.indices[t + 1] * 3;
      const c = part.indices[t + 2] * 3;
      const ax = part.positions[a];
      const ay = part.positions[a + 1];
      const az = part.positions[a + 2];
      const bx = part.positions[b];
      const by = part.positions[b + 1];
      const bz = part.positions[b + 2];
      const cx = part.positions[c];
      const cy = part.positions[c + 1];
      const cz = part.positions[c + 2];
      const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
      const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      view.setFloat32(offset, nx, true);
      view.setFloat32(offset + 4, ny, true);
      view.setFloat32(offset + 8, nz, true);
      const verts = [ax, ay, az, bx, by, bz, cx, cy, cz];
      for (let k = 0; k < 9; k++) view.setFloat32(offset + 12 + k * 4, verts[k], true);
      view.setUint16(offset + 48, 0, true);
      offset += 50;
    }
  }
  return buffer;
}

export function parseMeshFile(name: string, buffer: ArrayBuffer): TriangleMesh[] {
  const lower = name.toLowerCase();
  if (lower.endsWith('.stl')) return partitionSingle(normalizeMeshes(parseStl(buffer)));
  if (lower.endsWith('.obj')) return normalizeMeshes(parseObj(new TextDecoder().decode(buffer)));
  if (lower.endsWith('.glb') || lower.endsWith('.gltf')) return normalizeMeshes(parseGltf(buffer, lower.endsWith('.gltf')));
  throw new Error('只支持 STL、OBJ、GLB 或内嵌数据的 GLTF');
}

function parseStl(buffer: ArrayBuffer): TriangleMesh[] {
  const bytes = new Uint8Array(buffer);
  const head = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 240)));
  if (/solid/i.test(head) && /facet/i.test(new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 4000))))) {
    return [rawToMesh('imported', '模型', 'body', parseAsciiStl(new TextDecoder().decode(buffer)))];
  }
  return [rawToMesh('imported', '模型', 'body', parseBinaryStl(buffer))];
}

function parseAsciiStl(text: string): RawMesh {
  const positions: number[] = [];
  const indices: number[] = [];
  const re = /vertex\s+([+-eE\d.]+)\s+([+-eE\d.]+)\s+([+-eE\d.]+)/g;
  let match: RegExpExecArray | null;
  let count = 0;
  while ((match = re.exec(text))) {
    positions.push(Number(match[1]), Number(match[2]), Number(match[3]));
    count += 1;
    if (count % 3 === 0) {
      const base = count - 3;
      indices.push(base, base + 1, base + 2);
    }
  }
  if (indices.length < 3) throw new Error('这个 STL 里没有三角面');
  return { positions, indices };
}

function parseBinaryStl(buffer: ArrayBuffer): RawMesh {
  const view = new DataView(buffer);
  if (buffer.byteLength < 84) throw new Error('STL 文件太短');
  const count = view.getUint32(80, true);
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < count; i++) {
    const offset = 84 + i * 50;
    if (offset + 48 > buffer.byteLength) break;
    for (let v = 0; v < 3; v++) {
      const at = offset + 12 + v * 12;
      positions.push(view.getFloat32(at, true), view.getFloat32(at + 4, true), view.getFloat32(at + 8, true));
    }
    const base = i * 3;
    indices.push(base, base + 1, base + 2);
  }
  if (!indices.length) throw new Error('这个 STL 里没有三角面');
  return { positions, indices };
}

function parseObj(text: string): TriangleMesh[] {
  const verts: number[] = [];
  const groups: { name: string; positions: number[]; indices: number[] }[] = [];
  let current = { name: '模型', positions: [] as number[], indices: [] as number[] };
  const pushGroup = () => {
    if (current.indices.length) groups.push(current);
  };
  for (const line of text.split(/\r?\n/)) {
    const bits = line.trim().split(/\s+/);
    if (bits[0] === 'v' && bits.length >= 4) verts.push(Number(bits[1]), Number(bits[2]), Number(bits[3]));
    else if ((bits[0] === 'o' || bits[0] === 'g') && bits[1]) {
      pushGroup();
      current = { name: bits.slice(1).join(' '), positions: [], indices: [] };
    } else if (bits[0] === 'f' && bits.length >= 4) {
      const ids = bits.slice(1).map((token) => Number(token.split('/')[0]));
      const face = ids.map((id) => (id < 0 ? verts.length / 3 + id : id - 1));
      for (let i = 1; i < face.length - 1; i++) {
        const tri = [face[0], face[i], face[i + 1]];
        for (const index of tri) {
          current.indices.push(current.positions.length / 3);
          current.positions.push(verts[index * 3] || 0, verts[index * 3 + 1] || 0, verts[index * 3 + 2] || 0);
        }
      }
    }
  }
  pushGroup();
  if (!groups.length) throw new Error('这个 OBJ 里没有面');
  return groups.map((group, index) => rawToMesh(`obj-${index}`, group.name || `部件 ${index + 1}`, index === 0 ? 'body' : 'accent', { positions: group.positions, indices: group.indices }));
}

function parseGltf(buffer: ArrayBuffer, jsonOnly: boolean): TriangleMesh[] {
  let json: GltfJson;
  let bin: Uint8Array;
  if (jsonOnly) {
    json = JSON.parse(new TextDecoder().decode(buffer)) as GltfJson;
    const uri = json.buffers?.[0]?.uri ?? '';
    const marker = 'base64,';
    const at = uri.indexOf(marker);
    if (at < 0) throw new Error('请改用 GLB，或把数据内嵌在 GLTF 里');
    const raw = atob(uri.slice(at + marker.length));
    bin = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bin[i] = raw.charCodeAt(i);
  } else {
    const view = new DataView(buffer);
    if (view.getUint32(0, true) !== 0x46546c67) throw new Error('这不是 GLB 文件');
    let offset = 12;
    let jsonText = '';
    bin = new Uint8Array();
    while (offset + 8 <= buffer.byteLength) {
      const length = view.getUint32(offset, true);
      const type = view.getUint32(offset + 4, true);
      const chunk = new Uint8Array(buffer, offset + 8, length);
      if (type === 0x4e4f534a) jsonText = new TextDecoder().decode(chunk);
      if (type === 0x004e4942) bin = chunk;
      offset += 8 + length;
    }
    json = JSON.parse(jsonText) as GltfJson;
  }
  const meshes: TriangleMesh[] = [];
  (json.meshes ?? []).forEach((mesh, meshIndex) => {
    mesh.primitives.forEach((prim, primIndex) => {
      const positionAcc = json.accessors[prim.attributes.POSITION];
      const positions = readFloats(json, bin, positionAcc);
      let indices: number[];
      if (prim.indices != null) indices = readIndices(json, bin, json.accessors[prim.indices]);
      else indices = positions.map((_, index) => index / 3).filter((_, index) => index % 1 === 0);
      if (positions.length < 9 || indices.length < 3) return;
      meshes.push(rawToMesh(`glb-${meshIndex}-${primIndex}`, mesh.name || `部件 ${meshes.length + 1}`, meshes.length === 0 ? 'body' : 'accent', { positions, indices }));
    });
  });
  if (!meshes.length) throw new Error('这个模型里没有三角网格');
  return meshes;
}

interface GltfAccessor {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
}
interface GltfJson {
  buffers?: { uri?: string }[];
  bufferViews?: { byteOffset?: number; byteLength: number; byteStride?: number }[];
  accessors: GltfAccessor[];
  meshes?: { name?: string; primitives: { attributes: { POSITION: number }; indices?: number }[] }[];
}

function accessorBytes(json: GltfJson, bin: Uint8Array, accessor: GltfAccessor): { view: DataView; stride: number; start: number } {
  const bufferView = json.bufferViews?.[accessor.bufferView ?? 0];
  const start = (bufferView?.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = bufferView?.byteStride ?? 0;
  return { view: new DataView(bin.buffer, bin.byteOffset, bin.byteLength), stride, start };
}

function readFloats(json: GltfJson, bin: Uint8Array, accessor: GltfAccessor): number[] {
  const { view, stride, start } = accessorBytes(json, bin, accessor);
  const width = accessor.type === 'VEC3' ? 3 : 1;
  const step = stride || width * 4;
  const out: number[] = [];
  for (let i = 0; i < accessor.count; i++) {
    for (let k = 0; k < width; k++) out.push(view.getFloat32(start + i * step + k * 4, true));
  }
  return out;
}

function readIndices(json: GltfJson, bin: Uint8Array, accessor: GltfAccessor): number[] {
  const { view, stride, start } = accessorBytes(json, bin, accessor);
  const out: number[] = [];
  const width = accessor.componentType === 5123 ? 2 : accessor.componentType === 5125 ? 4 : 1;
  const step = stride || width;
  for (let i = 0; i < accessor.count; i++) {
    const at = start + i * step;
    if (accessor.componentType === 5123) out.push(view.getUint16(at, true));
    else if (accessor.componentType === 5125) out.push(view.getUint32(at, true));
    else out.push(view.getUint8(at));
  }
  return out;
}

function rawToMesh(id: string, name: string, role: PartRole, raw: RawMesh): TriangleMesh {
  return toMesh(id, name, role, raw);
}

function partitionSingle(parts: TriangleMesh[]): TriangleMesh[] {
  if (parts.length !== 1) return parts;
  const mesh = parts[0];
  const components = connectedComponents(mesh);
  if (components.length > 1) {
    return normalizeMeshes(components.map((part, index) => ({ ...part, id: `part-${index}`, name: `部件 ${index + 1}`, role: index === 0 ? 'body' : 'accent' })));
  }
  return normalizeMeshes(splitByHeight(mesh));
}

function connectedComponents(mesh: TriangleMesh): TriangleMesh[] {
  const vertexCount = mesh.positions.length / 3;
  const parent = new Uint32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) parent[i] = i;
  const find = (id: number): number => {
    let at = id;
    while (parent[at] !== at) at = parent[at];
    return at;
  };
  const unite = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  for (let i = 0; i < mesh.indices.length; i += 3) {
    unite(mesh.indices[i], mesh.indices[i + 1]);
    unite(mesh.indices[i], mesh.indices[i + 2]);
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const root = find(mesh.indices[i]);
    const bucket = groups.get(root) ?? [];
    bucket.push(mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]);
    groups.set(root, bucket);
  }
  if (groups.size <= 1) return [mesh];
  return [...groups.values()].map((indices) => repack(mesh, indices, 'accent'));
}

function splitByHeight(mesh: TriangleMesh): TriangleMesh[] {
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < mesh.positions.length; i += 3) {
    minY = Math.min(minY, mesh.positions[i]);
    maxY = Math.max(maxY, mesh.positions[i]);
  }
  const span = maxY - minY;
  if (span < 1e-4) return [mesh];
  const bands: number[][] = [[], [], []];
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const y = (mesh.positions[mesh.indices[t] * 3 + 1] + mesh.positions[mesh.indices[t + 1] * 3 + 1] + mesh.positions[mesh.indices[t + 2] * 3 + 1]) / 3;
    const band = Math.min(2, Math.floor(((y - minY) / span) * 3));
    bands[band].push(mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]);
  }
  const names: [string, PartRole][] = [
    ['下部', 'base'],
    ['主体', 'body'],
    ['上部', 'top'],
  ];
  const parts = bands
    .map((indices, index) => (indices.length ? { ...repack(mesh, indices, names[index][1]), id: `band-${index}`, name: names[index][0] } : null))
    .filter((part): part is TriangleMesh => !!part);
  return parts.length ? parts : [mesh];
}

function repack(mesh: TriangleMesh, indices: number[], role: PartRole): TriangleMesh {
  const map = new Map<number, number>();
  const positions: number[] = [];
  const packed: number[] = [];
  for (const index of indices) {
    let next = map.get(index);
    if (next == null) {
      next = positions.length / 3;
      map.set(index, next);
      positions.push(mesh.positions[index * 3], mesh.positions[index * 3 + 1], mesh.positions[index * 3 + 2]);
    }
    packed.push(next);
  }
  return {
    id: mesh.id,
    name: mesh.name,
    role,
    positions: Float32Array.from(positions),
    indices: Uint32Array.from(packed),
  };
}
