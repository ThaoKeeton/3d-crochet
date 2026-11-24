import { normalizeMeshes, place, toMesh, uvCone, uvSphere, uvTorus, type PartRole, type TriangleMesh } from './mesh';

export interface Palette {
  id: string;
  name: string;
  note: string;
  colors: Record<string, string>;
}

export interface SculptModel {
  name: string;
  prompt: string;
  parts: TriangleMesh[];
  palettes: Palette[];
  spoken: boolean;
}

const COLOR_WORDS: [string, string][] = [
  ['薄荷绿', '#7ec8bc'],
  ['奶绿', '#c5e2cf'],
  ['奶白', '#f7f3ea'],
  ['奶油', '#f4e3c8'],
  ['火星红', '#c44536'],
  ['海盐', '#d7e6ee'],
  ['雾蓝', '#8eabbe'],
  ['暖杏', '#e8c4a4'],
  ['亚麻', '#e6d3bc'],
  ['赤陶', '#c4624a'],
  ['橘', '#e08a4f'],
  ['橙', '#e08a4f'],
  ['红', '#c23b3b'],
  ['黑', '#1c1a19'],
  ['白', '#f7f4ee'],
  ['金', '#c6a15b'],
  ['粉', '#e7b7ae'],
  ['蓝', '#6f8fbf'],
  ['绿', '#6e8f62'],
  ['黄', '#e0b03a'],
  ['紫', '#8f3d55'],
  ['棕', '#8a5a3c'],
  ['灰', '#8d8680'],
];

type Subject = 'bear' | 'rabbit' | 'cat' | 'bag' | 'planet';

export function sculptFromPrompt(prompt: string): SculptModel {
  const text = prompt.trim() || '一只小熊挂件';
  const spoken = mentionedColors(text);
  const subject = detectSubject(text);
  const parts = normalizeMeshes(buildSubject(subject, text));
  const palettes = spoken.length ? spokenPalettes(parts, spoken) : themePalettes(parts, text, subject);
  return { name: titleFrom(text, subject), prompt: text, parts, palettes, spoken: spoken.length > 0 };
}

export function colorsOf(palette: Palette): Record<string, string> {
  return { ...palette.colors };
}

function titleFrom(prompt: string, subject: Subject): string {
  const cleaned = prompt.replace(/\s+/g, '');
  if (cleaned.length <= 18) return cleaned;
  const names: Record<Subject, string> = { bear: '小熊', rabbit: '兔子', cat: '小猫', bag: '圆包', planet: '星球挂件' };
  return names[subject];
}

function detectSubject(prompt: string): Subject {
  if (prompt.includes('包')) return 'bag';
  if (prompt.includes('兔')) return 'rabbit';
  if (prompt.includes('猫')) return 'cat';
  if (prompt.includes('星球') || prompt.includes('行星') || prompt.includes('火星')) {
    if (prompt.includes('熊') || prompt.includes('兔') || prompt.includes('猫') || prompt.includes('包')) {
      return prompt.includes('包') ? 'bag' : prompt.includes('兔') ? 'rabbit' : prompt.includes('猫') ? 'cat' : 'bear';
    }
    return 'planet';
  }
  if (prompt.includes('熊') || prompt.includes('公仔') || prompt.includes('挂件')) return 'bear';
  return 'bear';
}

function buildSubject(subject: Subject, prompt: string): TriangleMesh[] {
  const charm = /挂件|挂环|吊坠/.test(prompt);
  const hat = prompt.includes('帽');
  const scarf = prompt.includes('围巾');
  const flame = prompt.includes('火');
  const planetBit = prompt.includes('星球') || prompt.includes('行星');
  if (subject === 'bag') return bagParts(prompt.includes('耳') || prompt.includes('兔'), charm);
  if (subject === 'rabbit') return animalParts('rabbit', charm, hat, scarf, flame, planetBit && subject !== 'rabbit');
  if (subject === 'cat') return animalParts('cat', charm, hat, scarf, flame, false);
  if (subject === 'planet') return planetParts(flame, charm);
  return animalParts('bear', charm, hat, scarf, flame, planetBit);
}

function animalParts(kind: 'bear' | 'rabbit' | 'cat', charm: boolean, hat: boolean, scarf: boolean, flame: boolean, moon: boolean): TriangleMesh[] {
  const sphere = uvSphere(10, 14);
  const parts: TriangleMesh[] = [
    toMesh('body', '身体', 'body', place(sphere, [1.05, 0.95, 0.95], [0, 1.05, 0])),
    toMesh('head', '头', 'head', place(sphere, [0.72, 0.68, 0.7], [0, 2.15, 0.05])),
  ];
  if (kind === 'rabbit') {
    parts.push(ear('ear-l', '左耳', [-0.28, 2.85, 0], 0.22, 0.72));
    parts.push(ear('ear-r', '右耳', [0.28, 2.85, 0], 0.22, 0.72));
  } else if (kind === 'cat') {
    parts.push(ear('ear-l', '左耳', [-0.38, 2.62, 0], 0.2, 0.34));
    parts.push(ear('ear-r', '右耳', [0.38, 2.62, 0], 0.2, 0.34));
    parts.push(toMesh('tail', '尾巴', 'tail', place(sphere, [0.16, 0.16, 0.55], [0.7, 1.05, -0.15])));
  } else {
    parts.push(ear('ear-l', '左耳', [-0.42, 2.68, 0], 0.28, 0.28));
    parts.push(ear('ear-r', '右耳', [0.42, 2.68, 0], 0.28, 0.28));
  }
  parts.push(toMesh('snout', '鼻子', 'snout', place(sphere, [0.22, 0.16, 0.18], [0, 2.02, 0.62])));
  if (hat) parts.push(toMesh('hat', '帽子', 'hat', place(uvCone(1, 0.7, 16), [0.7, 0.55, 0.7], [0, 2.55, 0])));
  if (scarf) parts.push(scarfMesh());
  if (flame) parts.push(toMesh('flame', '火焰', 'flame', place(uvCone(1, 0.45, 12), [0.35, 0.7, 0.35], [0.85, 1.7, 0.2])));
  if (moon) parts.push(toMesh('moon', '星球', 'planet', place(sphere, [0.28, 0.28, 0.28], [1.15, 2.4, 0.2])));
  if (charm) parts.push(toMesh('loop', '挂环', 'loop', place(uvTorus(0.28, 0.07, 16, 8), [1, 1, 1], [0, 3.15, 0])));
  return parts;
}

function ear(id: string, name: string, at: [number, number, number], rx: number, ry: number): TriangleMesh {
  return toMesh(id, name, 'ear', place(uvSphere(8, 10), [rx, ry, rx * 0.7], at));
}

function scarfMesh(): TriangleMesh {
  const positions: number[] = [];
  const indices: number[] = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = -0.9 + t * 1.8;
    const x = Math.sin(a) * 0.85;
    const y = 1.72 + Math.cos(a) * 0.08;
    const z = 0.35 + (t - 0.5) * 0.1;
    positions.push(x, y, z, x, y - 0.22, z + 0.08);
  }
  for (let i = 0; i < steps; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  return toMesh('scarf', '围巾', 'scarf', { positions, indices });
}

function bagParts(ears: boolean, charm: boolean): TriangleMesh[] {
  const sphere = uvSphere(12, 16);
  const parts: TriangleMesh[] = [
    toMesh('body', '包身', 'body', place(sphere, [1.15, 0.95, 0.72], [0, 1.05, 0])),
    toMesh('strap', '包带', 'strap', place(uvTorus(0.85, 0.08, 20, 8), [1, 0.72, 1], [0, 2.15, 0])),
  ];
  if (ears) {
    parts.push(ear('ear-l', '左耳', [-0.45, 1.85, 0.15], 0.18, 0.48));
    parts.push(ear('ear-r', '右耳', [0.45, 1.85, 0.15], 0.18, 0.48));
  }
  if (charm) parts.push(toMesh('loop', '挂环', 'loop', place(uvTorus(0.22, 0.06, 14, 8), [1, 1, 1], [0, 2.7, 0])));
  return parts;
}

function planetParts(flame: boolean, charm: boolean): TriangleMesh[] {
  const sphere = uvSphere(12, 16);
  const parts: TriangleMesh[] = [
    toMesh('body', '星球', 'body', place(sphere, [1, 1, 1], [0, 1.2, 0])),
    toMesh('ring', '星环', 'planet', place(uvTorus(1.45, 0.06, 24, 6), [1, 0.35, 1], [0, 1.2, 0])),
  ];
  if (flame) parts.push(toMesh('flame', '火焰', 'flame', place(uvCone(1, 0.5, 12), [0.45, 0.8, 0.45], [0, 2.15, 0])));
  if (charm) parts.push(toMesh('loop', '挂环', 'loop', place(uvTorus(0.24, 0.06, 14, 8), [1, 1, 1], [0, 2.45, 0])));
  return parts;
}

function mentionedColors(prompt: string): { label: string; hex: string }[] {
  const found: { label: string; hex: string }[] = [];
  let index = 0;
  while (index < prompt.length) {
    const hit = COLOR_WORDS.find(([word]) => prompt.startsWith(word, index));
    if (hit) {
      found.push({ label: hit[0], hex: hit[1] });
      index += hit[0].length;
    } else index += 1;
  }
  return found;
}

const PRIMARY: PartRole[] = ['body', 'head', 'base'];
const SECONDARY: PartRole[] = ['ear', 'limb', 'tail', 'hat', 'scarf', 'flame', 'planet', 'strap', 'accent', 'loop', 'top'];

function paint(parts: TriangleMesh[], primary: string, secondary: string, snout: string): Record<string, string> {
  const colors: Record<string, string> = {};
  for (const part of parts) {
    if (part.role === 'snout') colors[part.id] = snout;
    else if (PRIMARY.includes(part.role)) colors[part.id] = primary;
    else if (SECONDARY.includes(part.role)) colors[part.id] = secondary;
    else colors[part.id] = primary;
  }
  return colors;
}

function spokenPalettes(parts: TriangleMesh[], spoken: { label: string; hex: string }[]): Palette[] {
  const primary = spoken[0].hex;
  const secondary = spoken[1]?.hex ?? shade(primary, -0.28);
  const snout = spoken[2]?.hex ?? '#f7f3ea';
  const labels = spoken.map((item) => item.label).join('');
  const base = paint(parts, primary, secondary, snout);
  const swapped = paint(parts, secondary, primary, snout);
  return [
    { id: 'spoken', name: `按你说的 · ${labels}`, note: '提示词里的颜色，直接铺到对应部件。', colors: base },
    { id: 'deep', name: '深一号', note: '同一组颜色压深，适合想要更沉的成品。', colors: mapColors(base, (hex) => shade(hex, -0.2)) },
    { id: 'soft', name: '浅一号', note: '同一组颜色提亮，线会更柔软。', colors: mapColors(base, (hex) => shade(hex, 0.24)) },
    { id: 'contrast', name: '撞色', note: '主色和配色对调。', colors: swapped },
  ];
}

function themePalettes(parts: TriangleMesh[], prompt: string, subject: Subject): Palette[] {
  const mars = /华晨宇|火星|应援/.test(prompt);
  if (mars) {
    return [
      pack(parts, 'mars', '火星红黑', '应援里最常见的红与黑。', '#c44536', '#1c1a19', '#f3e2c4'),
      pack(parts, 'gold', '黑金火焰', '黑底上用一点金。', '#1c1a19', '#c6a15b', '#f7f3ea'),
      pack(parts, 'space', '深空暗红', '红再沉一点，像夜场的光。', '#8d2e28', '#241816', '#e7b7ae'),
      pack(parts, 'pale', '浅焰奶杏', '把火星色洗淡，留一点暖。', '#e7a090', '#c4b4ae', '#f7f3ea'),
    ];
  }
  if (subject === 'cat' || prompt.includes('橘')) {
    return [
      pack(parts, 'orange', '橘猫奶油', '橘色身体，奶油鼻子和内耳。', '#e08a4f', '#f4e3c8', '#f7f3ea'),
      pack(parts, 'terra', '赤陶墨点', '橙再暖一点，耳朵用墨。', '#c4624a', '#2c2825', '#f7f3ea'),
      pack(parts, 'blush', '雾粉燕麦', '不那么橘，更像家养的浅色。', '#e7b7ae', '#e4c59a', '#f7f3ea'),
    ];
  }
  if (subject === 'rabbit' || subject === 'bag') {
    return [
      pack(parts, 'cream', '奶油雾粉', '包身或身体用奶油，耳朵用雾粉。', '#f4e3c8', '#e7b7ae', '#f7f3ea'),
      pack(parts, 'salt', '海盐奶白', '冷一点的白和海盐蓝。', '#f7f3ea', '#8eabbe', '#d7e6ee'),
      pack(parts, 'linen', '暖杏赤陶', '亚麻底上一点赤陶。', '#e8c4a4', '#c4624a', '#f7f3ea'),
    ];
  }
  if (subject === 'planet') {
    return [
      pack(parts, 'ink', '墨金星环', '星球用墨，环用金。', '#2c2825', '#c6a15b', '#f7f3ea'),
      pack(parts, 'sea', '海盐雾蓝', '冷色星球。', '#8eabbe', '#d7e6ee', '#f7f3ea'),
      pack(parts, 'mars', '火星赤陶', '暖色星球。', '#c44536', '#e8c4a4', '#f4e3c8'),
    ];
  }
  return [
    pack(parts, 'honey', '暖蜜可可', '小熊最稳的一套：蜜色身体，可可耳朵。', '#e0b03a', '#8a5a3c', '#f7f3ea'),
    pack(parts, 'terra', '赤陶燕麦', '身体赤陶，耳朵燕麦。', '#c4624a', '#e4c59a', '#f7f3ea'),
    pack(parts, 'linen', '雾蓝亚麻', '冷一点，仍是毛线的颜色。', '#8eabbe', '#e6d3bc', '#f7f3ea'),
    pack(parts, 'ink', '墨色点金', '深色身体，金耳朵。', '#2c2825', '#c6a15b', '#f4e3c8'),
  ];
}

function pack(parts: TriangleMesh[], id: string, name: string, note: string, primary: string, secondary: string, snout: string): Palette {
  return { id, name, note, colors: paint(parts, primary, secondary, snout) };
}

function mapColors(colors: Record<string, string>, fn: (hex: string) => string): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [id, hex] of Object.entries(colors)) next[id] = fn(hex);
  return next;
}

export function shade(hex: string, amount: number): string {
  const rgb = hexRgb(hex);
  const target = amount >= 0 ? [255, 255, 255] : [20, 16, 14];
  const t = Math.min(1, Math.abs(amount));
  const mixed = rgb.map((channel, index) => Math.round(channel + (target[index] - channel) * t));
  return rgbHex(mixed[0], mixed[1], mixed[2]);
}

function hexRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

function rgbHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export interface BlueprintPart {
  id: string;
  name: string;
  role: PartRole;
}

export interface Blueprint {
  name?: string;
  subject?: Subject;
  accessories?: string[];
  palettes: { id?: string; name: string; note?: string; colors: Record<string, string> }[];
}

export function modelFromBlueprint(prompt: string, blueprint: Blueprint): SculptModel {
  const subject = blueprint.subject ?? detectSubject(prompt);
  const extra = `${prompt} ${(blueprint.accessories ?? []).join('')}`;
  const parts = normalizeMeshes(buildSubject(subject, extra));
  const palettes = blueprint.palettes
    .map((palette, index) => ({
      id: palette.id || `remote-${index}`,
      name: palette.name || `方案 ${index + 1}`,
      note: palette.note || '来自你配置的模型。',
      colors: resolvePalette(parts, palette.colors),
    }))
    .filter((palette) => Object.keys(palette.colors).length > 0);
  const spoken = mentionedColors(prompt);
  const fallback = spoken.length ? spokenPalettes(parts, spoken) : themePalettes(parts, prompt, subject);
  return {
    name: blueprint.name || titleFrom(prompt, subject),
    prompt,
    parts,
    palettes: palettes.length >= 2 ? palettes : fallback,
    spoken: spoken.length > 0,
  };
}

function resolvePalette(parts: TriangleMesh[], colors: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of parts) {
    out[part.id] = colors[part.id] || colors[part.role] || colors.body || colors.head || '#c4624a';
  }
  return out;
}
