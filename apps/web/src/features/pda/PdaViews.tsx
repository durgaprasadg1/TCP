import type { PdaConfigStatus, PdaDefinition, PdaTraceNode } from '@cw/core';
import { cn } from '../../lib/cn';
import { pdaConfigText, pdaTransitionFull, sym } from '../../lib/format';
import { Term } from '../../components/ui';

/** Input string with consumed symbols dimmed and the next symbol to be read highlighted. */
export function InputStrip({ input, position }: { input: string; position: number }) {
  const chars = Array.from(input);
  if (chars.length === 0) {
    return (
      <div className="flex items-center gap-2 font-mono text-sm text-slate-400">
        <span className="rounded border border-accent bg-accent/15 px-2 py-1 text-accent">ε</span> empty input (nothing to read)
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1" aria-label={`Input ${input}, ${position} of ${chars.length} symbols consumed`}>
      {chars.map((c, i) => (
        <span
          key={i}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded border font-mono text-base',
            i < position ? 'border-ink-600 bg-ink-800 text-slate-500 line-through' : i === position ? 'border-accent bg-accent/20 text-accent ring-2 ring-accent/40' : 'border-ink-500 bg-ink-900 text-slate-100',
          )}
        >
          {c}
        </span>
      ))}
      <span className={cn('ml-1 text-xs', position === chars.length ? 'font-semibold text-accent' : 'text-slate-500')}>
        {position === chars.length ? '◀ all input consumed' : `position ${position}/${chars.length}`}
      </span>
    </div>
  );
}

const MAX_STACK_ROWS = 14;

/** Stack drawn vertically with the top clearly marked. `stack` is bottom -> top. */
export function StackView({ stack }: { stack: string[] }) {
  const reversed = [...stack].reverse(); // top first
  const shown = reversed.slice(0, MAX_STACK_ROWS);
  const hidden = reversed.length - shown.length;
  return (
    <div className="w-32" aria-label={stack.length === 0 ? 'Stack is empty' : `Stack, top is ${stack[stack.length - 1] ?? ''}, ${stack.length} symbols`}>
      <div className="mb-1 flex justify-between text-[11px] uppercase tracking-wider text-slate-500">
        <span>
          <Term k="stackTop">top</Term>
        </span>
        <span>{stack.length} sym.</span>
      </div>
      <div className="flex min-h-[3rem] flex-col rounded-b-md border-x-2 border-b-2 border-ink-500 bg-ink-900 p-1">
        {stack.length === 0 && <div className="py-3 text-center font-mono text-sm text-slate-500">∅ empty</div>}
        {shown.map((s, i) => (
          <div
            key={reversed.length - i}
            className={cn(
              'mb-1 flex h-8 items-center justify-center rounded border font-mono text-base last:mb-0',
              i === 0 ? 'border-accent bg-accent/20 text-accent' : 'border-ink-500 bg-ink-800 text-slate-100',
            )}
          >
            {s}
            {i === 0 && <span className="ml-2 text-[10px] uppercase text-accent/80">◀ top</span>}
          </div>
        ))}
        {hidden > 0 && <div className="text-center text-xs text-slate-500">… {hidden} more below</div>}
      </div>
      {stack.length > 0 && <div className="mt-1 text-center text-[11px] uppercase tracking-wider text-slate-500">bottom</div>}
    </div>
  );
}

const CONFIG_STATUS: Record<PdaConfigStatus, { label: string; cls: string }> = {
  ACTIVE: { label: 'expanded', cls: 'text-slate-400' },
  ACCEPTING: { label: 'accepting', cls: 'text-ok' },
  DEAD_END: { label: 'dead end', cls: 'text-bad' },
  PRUNED: { label: 'depth limit', cls: 'text-warn' },
  UNEXPANDED: { label: 'not expanded', cls: 'text-warn' },
};

interface ExplorerProps {
  input: string;
  nodes: PdaTraceNode[];
  levelIds: number[];
  depth: number;
  focusId: number | null;
  acceptingPath: number[];
  onSelect: (id: number) => void;
}

/**
 * Lists every configuration alive after `depth` steps. A nondeterministic PDA can have many at once;
 * click one to inspect it in the panels above.
 */
export function BranchExplorer({ input, nodes, levelIds, depth, focusId, acceptingPath, onSelect }: ExplorerProps) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const onPath = new Set(acceptingPath);
  const items = levelIds.map((id) => byId.get(id)).filter((n): n is PdaTraceNode => n !== undefined);
  return (
    <div>
      <p className="mb-2 text-sm text-slate-300" aria-live="polite">
        <strong className="font-mono text-black">{items.length}</strong> <Term k="configuration">configuration{items.length === 1 ? '' : 's'}</Term> exist
        {items.length === 1 ? 's' : ''} simultaneously after {depth} step{depth === 1 ? '' : 's'}.
        {items.length > 1 && <span className="text-slate-400"> The machine is <Term k="nondeterminism">nondeterministic</Term> here: all branches are followed.</span>}
      </p>
      <ul className="grid max-h-64 gap-1.5 overflow-auto sm:grid-cols-2">
        {items.map((n) => {
          const st = CONFIG_STATUS[n.configuration.status];
          return (
            <li key={n.id}>
              <button
                onClick={() => onSelect(n.id)}
                aria-pressed={n.id === focusId}
                className={cn(
                  'w-full rounded-md border px-2 py-1.5 text-left font-mono text-xs transition-colors',
                  n.id === focusId ? 'border-accent bg-accent/10' : 'border-ink-600 bg-ink-900 hover:bg-ink-800',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-100">{pdaConfigText(n.configuration, input)}</span>
                  <span className={cn('shrink-0', st.cls)}>{st.label}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {n.transitionId ? `via ${n.transitionId}` : 'start configuration'}
                  {onPath.has(n.id) && <span className="ml-2 text-ok">● on accepting path</span>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The chain of configurations from the start to the focused one. */
export function PdaHistory({
  input,
  lineage,
  def,
  currentDepth,
  onJump,
}: {
  input: string;
  lineage: PdaTraceNode[];
  def: PdaDefinition;
  currentDepth: number;
  onJump: (depth: number) => void;
}) {
  const byId = new Map(def.transitions.map((t) => [t.id, t]));
  return (
    <ol className="max-h-64 overflow-auto font-mono text-xs">
      {lineage.map((n) => {
        const t = n.transitionId ? byId.get(n.transitionId) : undefined;
        return (
          <li key={n.id}>
            <button
              onClick={() => onJump(n.depth)}
              className={cn('flex w-full items-baseline gap-2 border-l-2 px-2 py-1 text-left hover:bg-ink-800', n.depth === currentDepth ? 'border-accent bg-accent/10' : 'border-transparent')}
            >
              <span className="w-8 shrink-0 text-right text-slate-500">{n.depth}</span>
              <span className="text-slate-100">{pdaConfigText(n.configuration, input)}</span>
              {t && <span className="ml-auto shrink-0 text-slate-500">{t.id}</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function PdaTransitionTable({ def, activeId }: { def: PdaDefinition; activeId: string | null }) {
  if (def.transitions.length === 0) return <p className="text-sm text-slate-400">This machine has no transitions.</p>;
  return (
    <div className="max-h-72 overflow-auto">
      <table className="w-full min-w-[420px] border-collapse text-left">
        <thead className="sticky top-0 bg-ink-850">
          <tr>
            {['id', 'state', 'input', 'stack top', 'next', 'push (top first)'].map((h) => (
              <th key={h} className="th">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {def.transitions.map((t) => (
            <tr key={t.id} className={cn('border-t border-ink-700', t.id === activeId && 'bg-accent/15 text-accent')} title={pdaTransitionFull(t)}>
              <td className="td text-slate-500">{t.id}</td>
              <td className="td">{t.from}</td>
              <td className="td">{sym(t.input)}</td>
              <td className="td">{sym(t.stackTop)}</td>
              <td className="td">{t.to}</td>
              <td className="td">{sym(t.push)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
