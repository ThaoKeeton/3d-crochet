import { useEffect, useState } from 'react';

interface Presence {
  orbiting: boolean;
  playing: boolean;
}

let state: Presence = { orbiting: false, playing: false };
let playToggle: (() => void) | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function patchPresence(next: Partial<Presence>) {
  const merged = { ...state, ...next };
  if (merged.orbiting === state.orbiting && merged.playing === state.playing) return;
  state = merged;
  emit();
}

export function setPlayToggle(fn: (() => void) | null) {
  playToggle = fn;
}

export function togglePlay() {
  playToggle?.();
}

export function usePresence() {
  const [value, setValue] = useState(state);
  useEffect(() => {
    const fn = () => setValue(state);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return value;
}
