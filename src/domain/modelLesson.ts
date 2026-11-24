import type { Graph, TeachStep } from './types';

export interface ModelLesson {
  id: string;
  title: string;
  kicker: string;
  summary: string;
  done: string;
  path: 0 | 1 | 2 | 3;
  minutes: number;
  graph: Graph;
  steps: TeachStep[];
  spin: number;
  color: string;
}

let current: ModelLesson | null = null;

export function publishModelLesson(lesson: ModelLesson) {
  current = lesson;
}

export function modelLesson(): ModelLesson | null {
  return current;
}
