import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PdaDefinition, PdaExecutionOptions, PdaTraceNode } from '@cw/core';
import { ExecutionControls, SPEEDS } from '../../components/ExecutionControls';
import { StateDiagram } from '../../components/StateDiagram';
import { Card, ErrorBanner, IssueList, StatusBadge, Stat, Term } from '../../components/ui';
import { usePlayback } from '../../hooks/usePlayback';
import { api, errorMessage } from '../../lib/api';
import type { PdaResponse } from '../../lib/api';
import { pdaConfigText, pdaTransitionFull } from '../../lib/format';
import { pdaGraph } from '../../lib/graph';
import { BranchExplorer, InputStrip, PdaHistory, PdaTransitionTable, StackView } from './PdaViews';

interface Props {
  definition: PdaDefinition;
  input: string;
  onInputChange: (s: string) => void;
  /** Bump to execute immediately (used when a lab is opened from a link). */
  autoRunKey?: number;
}

const BUDGET_DEFAULTS = { maxConfigurations: 5000, maxStackSize: 200, maxDepth: 2000 };

/**
 * Runs a PDA on the Express API and replays the returned computation tree.
 * Frame d = every configuration alive after d transitions. All displayed data is taken from the engine's trace.
 */
export function PdaWorkspace({ definition, input, onInputChange, autoRunKey }: Props) {
  const [result, setResult] = useState<PdaResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speedMs, setSpeedMs] = useState<number>(SPEEDS[1].ms);
  const [budget, setBudget] = useState(BUDGET_DEFAULTS);
  const [exploreAll, setExploreAll] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const frameCount = result ? Math.max(result.levels.length, 1) : 0;
  const playback = usePlayback(frameCount, speedMs);

  // A different machine, input or budget makes the previous trace stale.
  useEffect(() => {
    setResult(null);
    setError(null);
    setSelectedId(null);
  }, [definition, input, budget, exploreAll]);

  const execute = useCallback(async (): Promise<PdaResponse | null> => {
    setBusy(true);
    setError(null);
    const options: PdaExecutionOptions = { ...budget, stopOnAccept: !exploreAll, maxTraceNodes: 3000 };
    try {
      const r = await api.executePda(definition, input, options);
      setResult(r);
      setSelectedId(null);
      return r;
    } catch (e) {
      setError(errorMessage(e));
      return null;
    } finally {
      setBusy(false);
    }
  }, [definition, input, budget, exploreAll]);

  // Playback must start after the new trace has been committed (the cursor resets when a trace arrives).
  const [playWhenLoaded, setPlayWhenLoaded] = useState(false);
  useEffect(() => {
    if (playWhenLoaded && result) {
      setPlayWhenLoaded(false);
      playback.play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playWhenLoaded, result]);

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

  const autoKey = autoRunKey ?? 0;
  useEffect(() => {
    if (autoKey > 0) void execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKey]);

  const nodeById = useMemo(() => new Map((result?.nodes ?? []).map((n) => [n.id, n])), [result]);
  const depth = playback.index;
  const levelIds = useMemo(() => result?.levels[depth] ?? [], [result, depth]);

  // The configuration shown in detail: user selection, else the accepting-path node of this level, else the first one.
  const focus: PdaTraceNode | null = useMemo(() => {
    if (!result) return null;
    const sel = selectedId === null ? undefined : nodeById.get(selectedId);
    if (sel && sel.depth === depth) return sel;
    const onPath = result.acceptingPath.map((id) => nodeById.get(id)).find((n) => n?.depth === depth);
    if (onPath) return onPath;
    const first = levelIds[0];
    return first === undefined ? null : (nodeById.get(first) ?? null);
  }, [result, selectedId, nodeById, depth, levelIds]);

  const lineage = useMemo(() => {
    const out: PdaTraceNode[] = [];
    for (let n: PdaTraceNode | undefined | null = focus; n; n = n.parentId === null ? null : nodeById.get(n.parentId)) out.unshift(n);
    return out;
  }, [focus, nodeById]);

  const graph = useMemo(() => pdaGraph(definition), [definition]);
  const activeTransition = focus?.transitionId ? definition.transitions.find((t) => t.id === focus.transitionId) : undefined;
  const atEnd = result !== null && playback.atEnd;
  const noTrace = result !== null && result.nodes.length === 0;

  return (
    <div className="space-y-4">
      <Card title="Run">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div>
            <label className="label" htmlFor="pda-input">
              Input string (type ε or leave empty for the empty string)
            </label>
            <input
              id="pda-input"
              className="input"
              value={input}
              onChange={(e) => onInputChange(e.target.value === 'ε' ? '' : e.target.value)}
              spellCheck={false}
              autoComplete="off"
              placeholder="e.g. aabb"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void run();
              }}
            />
          </div>
          <details className="rounded-md border border-ink-600 bg-ink-900 px-3 py-2 text-sm lg:w-[22rem]">
            <summary className="cursor-pointer text-slate-300">Exploration budget</summary>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(
                [
                  ['maxConfigurations', 'Max configs', 20000],
                  ['maxStackSize', 'Max stack', 500],
                  ['maxDepth', 'Max depth', 5000],
                ] as const
              ).map(([key, label, max]) => (
                <label key={key} className="text-xs text-slate-400">
                  {label}
                  <input
                    type="number"
                    min={1}
                    max={max}
                    className="input mt-1"
                    value={budget[key]}
                    onChange={(e) => setBudget((b) => ({ ...b, [key]: Math.max(1, Math.min(max, Math.floor(Number(e.target.value)) || 1)) }))}
                  />
                </label>
              ))}
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={exploreAll} onChange={(e) => setExploreAll(e.target.checked)} />
              Keep exploring after the first accepting configuration
            </label>
            <p className="mt-2 text-xs text-slate-500">
              Hitting a limit gives <Term k="inconclusive">INCONCLUSIVE</Term>, never REJECTED.
            </p>
          </details>
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
                ? `Step ${depth} of ${frameCount - 1} · ${levelIds.length} configuration${levelIds.length === 1 ? '' : 's'} alive`
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card title="State diagram">
          <StateDiagram graph={graph} currentState={focus?.configuration.state ?? null} activeTransitionId={focus?.transitionId ?? null} height={360} />
        </Card>

        <Card title="Current configuration">
          {!result && <p className="text-sm text-slate-400">Run the machine to see its configurations here.</p>}
          {result && noTrace && <p className="text-sm text-slate-400">No transitions were executed, see the outcome below.</p>}
          {result && focus && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Step" value={focus.depth} />
                <Stat label="State" value={focus.configuration.state} />
                <Stat label="Position" value={`${focus.configuration.position}/${Array.from(input).length}`} />
              </div>
              <div>
                <div className="label">Input</div>
                <InputStrip input={input} position={focus.configuration.position} />
              </div>
              <div className="flex flex-wrap items-start gap-6">
                <StackView stack={focus.configuration.stack} />
                <div className="min-w-0 flex-1 space-y-2 text-sm">
                  <div>
                    <div className="label">
                      <Term k="configuration">Configuration</Term> (state, remaining input, stack top first)
                    </div>
                    <code className="block break-all rounded bg-ink-900 px-2 py-1 text-slate-100">{pdaConfigText(focus.configuration, input)}</code>
                  </div>
                  <div>
                    <div className="label">Transition just applied</div>
                    <code className="block break-all rounded bg-ink-900 px-2 py-1 text-accent">
                      {activeTransition ? `${activeTransition.id}: ${pdaTransitionFull(activeTransition)}` : 'none: this is the start configuration'}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {result && !noTrace && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card title="Configuration explorer (all branches)">
            <BranchExplorer input={input} nodes={result.nodes} levelIds={levelIds} depth={depth} focusId={focus?.id ?? null} acceptingPath={result.acceptingPath} onSelect={setSelectedId} />
          </Card>
          <Card title="Execution history (selected branch)">
            <PdaHistory input={input} lineage={lineage} def={definition} currentDepth={depth} onJump={playback.setIndex} />
          </Card>
        </div>
      )}

      {result && (atEnd || noTrace) && (
        <Card title="Final outcome" className={result.status === 'ACCEPTED' ? 'border-ok/50' : result.status === 'REJECTED' ? 'border-bad/40' : result.status === 'INCONCLUSIVE' ? 'border-warn/50' : ''}>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={result.status} />
              {result.acceptedBy && (
                <span className="text-sm text-slate-400">
                  by <Term k={result.acceptedBy === 'FINAL_STATE' ? 'finalState' : 'emptyStack'}>{result.acceptedBy === 'FINAL_STATE' ? 'final state' : 'empty stack'}</Term>
                </span>
              )}
            </div>
            <p className="text-sm text-slate-300">{result.reason}</p>
            {result.status === 'INVALID_MACHINE' && <IssueList issues={result.issues} />}
            {result.status !== 'INVALID_MACHINE' && (
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <Stat label="Configs created" value={result.stats.configurationsCreated} />
                <Stat label="Expanded" value={result.stats.configurationsExpanded} />
                <Stat label="Duplicates pruned" value={result.stats.duplicatesPruned} hint="Configurations reached again by another route are not explored twice. This is what stops ε-cycles." />
                <Stat label="Max simultaneous" value={result.stats.maxSimultaneous} hint="Largest number of configurations waiting at once" />
                <Stat label="Max stack seen" value={result.stats.maxStackSeen} />
                <Stat label="Limit hit" value={result.stats.limitHit ?? 'none'} />
              </div>
            )}
            {result.traceTruncated && <p className="text-xs text-warn">The trace was truncated to keep the response small; the verdict is still exact.</p>}
          </div>
        </Card>
      )}

      <Card title="Transition table">
        <PdaTransitionTable def={definition} activeId={focus?.transitionId ?? null} />
      </Card>
    </div>
  );
}
