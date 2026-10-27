import { ChevronFirst, ChevronLast, Pause, Play, RotateCcw, StepBack, StepForward } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Playback } from '../hooks/usePlayback';

export const SPEEDS = [
  { label: 'Slow (1.2 s)', ms: 1200 },
  { label: 'Normal (600 ms)', ms: 600 },
  { label: 'Fast (250 ms)', ms: 250 },
  { label: 'Very fast (80 ms)', ms: 80 },
] as const;

interface Props {
  playback: Playback;
  /** True once an execution result exists. */
  hasResult: boolean;
  busy: boolean;
  onRun: () => void;
  onNext: () => void;
  onReset: () => void;
  speedMs: number;
  onSpeed: (ms: number) => void;
  frameLabel: ReactNode;
}

/** Run / Pause / Next / Previous / Reset / Speed, shared by both laboratories. Every control is wired. */
export function ExecutionControls({ playback, hasResult, busy, onRun, onNext, onReset, speedMs, onSpeed, frameLabel }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Execution controls">
      {playback.playing ? (
        <button className="btn btn-primary" onClick={playback.pause} aria-label="Pause">
          <Pause className="h-4 w-4" aria-hidden /> Pause
        </button>
      ) : (
        <button className="btn btn-primary" onClick={onRun} disabled={busy} aria-label="Run">
          <Play className="h-4 w-4" aria-hidden /> Run
        </button>
      )}
      <button className="btn btn-icon" onClick={playback.prev} disabled={!hasResult || playback.atStart} aria-label="Previous step" title="Previous step">
        <StepBack className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Prev</span>
      </button>
      <button className="btn btn-icon" onClick={onNext} disabled={busy || (hasResult && playback.atEnd)} aria-label="Next step" title="Next step (loads the computation first if needed)">
        <StepForward className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Next</span>
      </button>
      <button className="btn btn-icon" onClick={playback.last} disabled={!hasResult || playback.atEnd} aria-label="Jump to the end" title="Jump to the end">
        <ChevronLast className="h-4 w-4" aria-hidden />
      </button>
      <button className="btn btn-icon" onClick={onReset} disabled={!hasResult} aria-label="Reset to the first configuration" title="Reset to the first configuration">
        <ChevronFirst className="h-4 w-4" aria-hidden />
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">Reset</span>
      </button>
      <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">
        Speed
        <select className="input !w-auto !py-1" value={speedMs} onChange={(e) => onSpeed(Number(e.target.value))} aria-label="Execution speed">
          {SPEEDS.map((s) => (
            <option key={s.ms} value={s.ms}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <div className="w-full font-mono text-xs text-slate-400" aria-live="polite">
        {frameLabel}
      </div>
    </div>
  );
}
