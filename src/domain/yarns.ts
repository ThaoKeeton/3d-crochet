export interface YarnColor {
  id: string;
  name: string;
  hex: string;
}

export const YARNS: YarnColor[] = [
  { id: 'cream', name: '牛乳', hex: '#f0d3b0' },
  { id: 'oat', name: '燕麦', hex: '#e4c59a' },
  { id: 'sand', name: '沙色', hex: '#d7b184' },
  { id: 'persimmon', name: '柿子', hex: '#e08a4f' },
  { id: 'terra', name: '赤陶', hex: '#c4624a' },
  { id: 'berry', name: '梅子', hex: '#8f3d55' },
  { id: 'mustard', name: '姜黄', hex: '#e0b03a' },
  { id: 'matcha', name: '抹茶', hex: '#6e8f62' },
  { id: 'celadon', name: '青瓷', hex: '#6aa39a' },
  { id: 'indigo', name: '靛蓝', hex: '#3d5274' },
  { id: 'ink', name: '墨', hex: '#2c2825' },
  { id: 'blush', name: '雾粉', hex: '#e7b7ae' },
];

export function yarnByHex(hex: string): YarnColor | undefined {
  return YARNS.find((y) => y.hex.toLowerCase() === hex.toLowerCase());
}

export const DEFAULT_COASTER = YARNS[4].hex;
export const DEFAULT_SQUARE = YARNS[3].hex;
export const DEFAULT_STRAP = YARNS[4].hex;
export const SEAM_YARN = '#d7b48a';
