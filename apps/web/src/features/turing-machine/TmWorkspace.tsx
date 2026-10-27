import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TmDefinition } from '@cw/core';
import { ExecutionControls, SPEEDS } from '../../components/ExecutionControls';
import { StateDiagram } from '../../components/StateDiagram';
import { Card, ErrorBanner, IssueList, Stat, StatusBadge, Term } from '../../components/ui';
import { usePlayback } from '../../hooks/usePlayback';
import { api, errorMessage } from '../../lib/api';
import type { TmResponse } from '../../lib/api';
import { MOVE_LABEL, tmTransitionFull } from '../../lib/format';
import { tmGraph } from '../../lib/graph';
import { BlankHint, TapeView, TmHistory, TmTransitionTable } from './TmViews';

interface Props {
  definition: TmDefinition;
  input: string;
  onInputChange: (s: string) => void;
  autoRunKey?: number;
}

/** Runs a TM on the Express API and replays the returned configurations. The UI never applies a transition itself. */
export function TmWorkspace({ definition, input, onInputChange, autoRunKey }: Props) {
  const [result, setResult] = useState<TmResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speedMs, setSpeedMs] = useState<number>(SPEEDS[2].ms);
  const [maxSteps, setMaxSteps] = useState(5000);
  const [playWhenLoaded, setPlayWhenLoaded] = useState(false);

  const frameCount = result ? result.configurations.length : 0;
  const playback = usePlayback(frameCount, speedMs);

  useEffect(() => {
    setResult(null);
    setError(null);
  }, [definition, input, maxSteps]);

  const execute = useCallback(async (): Promise<TmResponse | null> => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.executeTm(definition, input, { maxSteps, maxTraceSteps: 3000 });
      setResult(r);
      return r;
    } catch (e) {
      setError(errorMessage(e));
      return null;
    } finally {
      setBusy(false);
    }
  }, [definition, input, maxSteps]);

  useEffect(() => {
    if (playWhenLoaded && result) {
      setPlayWhenLoaded(false);
      playback.play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playWhenLoaded, result]);

  const autoKey = autoRunKey ?? 0;
  useEffect(() => {
    if (autoKey > 0) void execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKey]);

  const run = async () => {
    if (result) {
      playback.play();
      return;
    }
    setPlayWhenLoaded(true);
    if (!(await execute())) setPlayWhenLoaded(false);
  };
  const next = async () => {
    if (!result) {
      await execute();
      return;
    }
    playback.next();
  };

  const configs = result?.configurations ?? [];
  const cfg = configs[playback.index] ?? null;
  const prev = playback.index > 0 ? configs[playback.index - 1] : undefined;
  const writtenAt = cfg?.applied && prev && cfg.step === prev.step + 1 ? prev.head : null;
  const graph = useMemo(() => tmGraph(definition), [definition]);
  const noTrace = result !== null && configs.length === 0;
  const atEnd = result !== null && playback.atEnd;

  return (
    <div className="space-y-4">
      <Card title="Run">
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <div>
            <label className="label" htmlFor="tm-input">
              Input string (written on cells 0…n−1; leave empty for a blank tape)
            </label>
            <input
              id="tm-input"
              className="input"
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              placeholder="e.g. aabbcc"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void run();
              }}
            />
          </div>
          <div>
            <label className="label" htmlFor="tm-steps">
              Maximum steps
            </label>
            <input id="tm-steps" type="number" min={1} max={200000} className="input" value={maxSteps} onChange={(e) => setMaxSteps(Math.max(1, Math.min(200000, Math.floor(Number(e.target.value)) || 1)))} />
          </div>
        </div>
        <div className="mt-3">
          <ExecutionControls
            playback={playback}
            hasResult={result !== null && !noTrace}
            busy={busy}
            onRun={() => void run()}
            onNext={() => void next()}
            onReset={playback.reset}
            speedMs={speedMs}
            onSpeed={setSpeedMs}
            frameLabel={
              result && !noTrace
                ? `Frame ${playback.index + 1} of ${frameCount} · step ${cfg?.step ?? 0}${result.traceTruncated ? ' (trace truncated; the verdict is still exact)' : ''}`
                : busy
                  ? 'Executing on the server…'
                  : 'Not executed yet. Run plays the whole computation; Next Step loads it and lets you step manually.'
            }
          />
        </div>
        {error && (
          <div className="mt-3">
            <ErrorBanner message={error} onRetry={() => void execute()} />
          </div>
        )}
      </Card>

      <Card title="Tape" actions={<BlankHint blank={definition.blank} />}>
        {cfg ? (
          <TapeView tape={cfg.tape} head={cfg.head} blank={definition.blank} writtenAt={writtenAt} />
        ) : (
          <p className="text-sm text-slate-400">Run the machine to see the tape.</p>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card title="State diagram">
          <StateDiagram graph={graph} currentState={cfg?.state ?? null} activeTransitionId={cfg?.applied?.id ?? null} height={460} />
        </Card>
        <Card title="Current configuration">
          {!cfg && <p className="text-sm text-slate-400">Nothing to show yet.</p>}
          {cfg && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Step" value={cfg.step} />
                <Stat label="State" value={cfg.state} />
                <Stat label={<Term k="head">Head</Term>} value={cfg.head} />
                <Stat label="Under head" value={cfg.symbolUnderHead} />
              </div>
              <div className="rounded-md border border-ink-700 bg-ink-900 p-2 text-sm">
                <div className="label">Transition just applied</div>
                {cfg.applied ? (
                  <>
                    <code className="block text-accent">
                      {cfg.applied.id}: {tmTransitionFull(cfg.applied)}
                    </code>
                    <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <dt className="text-slate-500">Symbol read</dt>
                        <dd className="font-mono text-base text-slate-100">{cfg.applied.read}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Symbol written</dt>
                        <dd className="font-mono text-base text-warn">{cfg.applied.write}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Head movement</dt>
                        <dd className="font-mono text-base text-slate-100">{MOVE_LABEL[cfg.applied.move]}</dd>
                      </div>
                    </dl>
                  </>
                ) : (
                  <p className="text-slate-400">None: this is the initial configuration.</p>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {result && !noTrace && (
        <Card title="Execution history">
          <TmHistory configs={configs} index={playback.index} onJump={playback.setIndex} />
        </Card>
      )}

      {result && (atEnd || noTrace) && (
        <Card title="Final outcome" className={result.status === 'ACCEPTED' ? 'border-ok/50' : result.status === 'REJECTED' ? 'border-bad/40' : result.status === 'INCONCLUSIVE' ? 'border-warn/50' : ''}>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={result.status} />
              <span className="font-mono text-xs text-slate-400">{result.haltReason.replace(/_/g, ' ').toLowerCase()}</span>
              {result.haltReason === 'MISSING_TRANSITION' && <Term k="implicitReject">implicit reject</Term>}
            </div>
            <p className="text-sm text-slate-300">{result.reason}</p>
            {result.status === 'INVALID_MACHINE' && <IssueList issues={result.issues} />}
            {result.status !== 'INVALID_MACHINE' && !result.rejectedByAlphabet && (
              <div className="grid gap-2 sm:grid-cols-3">
                <Stat label="Steps executed" value={result.steps} />
                <Stat label="Final tape content" value={result.finalTapeContent === '' ? '(blank)' : result.finalTapeContent} />
                <Stat label="Step limit" value={maxSteps} />
              </div>
            )}
            {result.status === 'INCONCLUSIVE' && (
              <p className="text-xs text-warn">
                <Term k="inconclusive">Inconclusive</Term> does not mean the machine loops: raise the limit to keep running, but no finite simulation can prove non-termination.
              </p>
            )}
          </div>
        </Card>
      )}

      <Card title="Transition table">
        <TmTransitionTable def={definition} activeId={cfg?.applied?.id ?? null} />
      </Card>
    </div>
  );
}
