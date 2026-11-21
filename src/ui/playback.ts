import { useEffect, useRef, useState } from 'react';

export interface Playable {
  stitchId: string;
}

export function usePlayback(steps: Playable[], speed: number, reduce: boolean, startIndex = 0) {
  const startRef = useRef(startIndex);
  startRef.current = startIndex;
  const [index, setIndex] = useState(() => Math.max(0, startIndex));
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);
  const [runAll, setRunAll] = useState(false);
  const playRef = useRef({ index: Math.max(0, startIndex), t: reduce ? 1 : 0, reduce });
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  playRef.current.index = index;
  playRef.current.reduce = reduce;
  const signature = steps[0]?.stitchId ?? 'empty';

  useEffect(() => {
    const start = Math.max(0, Math.min(stepsRef.current.length - 1, startRef.current));
    setIndex(start);
    setPlaying(false);
    playRef.current.t = reduce ? 1 : 0;
    playRef.current.index = start;
  }, [signature, steps.length, reduce, startIndex]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const dur = (slow ? 2.25 : 1.05) / Math.max(0.35, speed);
      if (playRef.current.t < 1) playRef.current.t = reduce ? 1 : Math.min(1, playRef.current.t + dt / dur);
      if (playing && playRef.current.t >= 1) {
        const list = stepsRef.current;
        const current = playRef.current.index;
        const next = current + 1;
        if (next >= list.length) setPlaying(false);
        else if (!runAll && list[next]?.stitchId !== list[current]?.stitchId) setPlaying(false);
        else {
          playRef.current.t = 0;
          setIndex(next);
        }
      }
      const idle = !playing && playRef.current.t >= 1;
      if (!idle) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, slow, speed, reduce, runAll, index]);

  const jump = (next: number) => {
    const clamped = Math.max(0, Math.min(steps.length - 1, next));
    playRef.current.t = reduce ? 1 : 0;
    playRef.current.index = clamped;
    setIndex(clamped);
  };

  const nextStitch = () => {
    const id = steps[index]?.stitchId;
    const found = steps.findIndex((step, i) => i > index && step.stitchId !== id);
    jump(found === -1 ? steps.length - 1 : found);
  };

  return { index, setIndex: jump, playing, setPlaying, slow, setSlow, runAll, setRunAll, playRef, nextStitch };
}
