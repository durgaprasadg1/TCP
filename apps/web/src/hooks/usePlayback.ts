import { useCallback, useEffect, useState } from 'react';

export interface Playback {
  index: number;
  playing: boolean;
  setIndex: (i: number) => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  reset: () => void;
  last: () => void;
  atStart: boolean;
  atEnd: boolean;
}

/**
 * Timer-driven cursor over `frameCount` precomputed frames. It owns no machine logic: frames come from
 * the execution engine's trace and this hook only moves an index.
 */
export function usePlayback(frameCount: number, intervalMs: number): Playback {
  const [index, setIndexRaw] = useState(0);
  const [playing, setPlaying] = useState(false);

  const clamp = useCallback((i: number) => Math.max(0, Math.min(i, Math.max(frameCount - 1, 0))), [frameCount]);

  useEffect(() => {
    if (!playing) return;
    if (index >= frameCount - 1) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => setIndexRaw((i) => clamp(i + 1)), intervalMs);
    return () => window.clearTimeout(t);
  }, [playing, index, frameCount, intervalMs, clamp]);

  // A new trace invalidates the cursor.
  useEffect(() => {
    setIndexRaw(0);
    setPlaying(false);
  }, [frameCount]);

  return {
    index: clamp(index),
    playing,
    setIndex: (i) => setIndexRaw(clamp(i)),
    play: () => {
      setIndexRaw((i) => (i >= frameCount - 1 ? 0 : i));
      setPlaying(true);
    },
    pause: () => setPlaying(false),
    next: () => {
      setPlaying(false);
      setIndexRaw((i) => clamp(i + 1));
    },
    prev: () => {
      setPlaying(false);
      setIndexRaw((i) => clamp(i - 1));
    },
    reset: () => {
      setPlaying(false);
      setIndexRaw(0);
    },
    last: () => {
      setPlaying(false);
      setIndexRaw(clamp(frameCount - 1));
    },
    atStart: index <= 0,
    atEnd: index >= frameCount - 1,
  };
}
