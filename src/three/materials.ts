import * as THREE from 'three';

export interface YarnUniforms {
  uDraw: { value: number };
  uHiA: { value: number };
  uHiB: { value: number };
  uDoneA: { value: number };
  uDoneB: { value: number };
  uHi: { value: THREE.Color };
}

export function createYarnMaterial(color: string, uniforms?: YarnUniforms): THREE.MeshPhysicalMaterial {
  const base = new THREE.Color(color);
  const sheen = base.clone().lerp(new THREE.Color('#fff6ee'), 0.28);
  const material = new THREE.MeshPhysicalMaterial({
    color: base,
    roughness: 0.78,
    metalness: 0,
    sheen: 0.35,
    sheenRoughness: 0.62,
    sheenColor: sheen,
    clearcoat: 0,
    side: THREE.DoubleSide,
  });
  material.defines = { USE_UV: '' };
  material.customProgramCacheKey = () => 'gouzhi-yarn-uv';
  material.onBeforeCompile = (shader) => {
    const draw = uniforms?.uDraw ?? { value: 1 };
    const hiA = uniforms?.uHiA ?? { value: -1 };
    const hiB = uniforms?.uHiB ?? { value: -1 };
    const doneA = uniforms?.uDoneA ?? { value: -1 };
    const doneB = uniforms?.uDoneB ?? { value: -1 };
    const hi = uniforms?.uHi ?? { value: new THREE.Color('#fff1d4') };
    shader.uniforms.uDraw = draw;
    shader.uniforms.uHiA = hiA;
    shader.uniforms.uHiB = hiB;
    shader.uniforms.uDoneA = doneA;
    shader.uniforms.uDoneB = doneB;
    shader.uniforms.uHi = hi;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aAlong;\nvarying float vAlong;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvAlong = aAlong;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uDraw;
uniform float uHiA;
uniform float uHiB;
uniform float uDoneA;
uniform float uDoneB;
uniform vec3 uHi;
varying float vAlong;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float ply = sin(vUv.y * 12.56637 + vUv.x * 2.4);
float fiber = sin(vUv.y * 37.6991 + vUv.x * 9.0);
float groove = smoothstep(-0.15, 0.9, ply);
diffuseColor.rgb *= mix(0.72, 1.06, groove);
diffuseColor.rgb *= 0.94 + 0.06 * fiber;
if (vAlong > uDraw + 0.0008) discard;
if (uDoneB > uDoneA && vAlong >= uDoneA && vAlong <= uDoneB) {
  diffuseColor.rgb = mix(diffuseColor.rgb, uHi, 0.28);
}
if (uHiB > uHiA && vAlong >= uHiA && vAlong <= uHiB) {
  diffuseColor.rgb = mix(diffuseColor.rgb, uHi, 0.62);
}`,
      );
  };
  return material;
}

export function hookMetal(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#e7ebf0',
    metalness: 0.78,
    roughness: 0.22,
    emissive: '#5c6168',
    emissiveIntensity: 0.12,
    side: THREE.DoubleSide,
  });
}

export function hookWood(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: '#8d5a3b',
    metalness: 0.04,
    roughness: 0.62,
    side: THREE.DoubleSide,
  });
}
