import type { TapeSnapshot, TmConfiguration, TmDefinition } from '@cw/core';
import { cn } from '../../lib/cn';
import { MOVE_ARROW, tmTransitionFull } from '../../lib/format';
import { Term } from '../../components/ui';

const WINDOW = 10; // cells shown each side of the head

/**
 * Tape window centred on the head. Cells outside the snapshot are blank by definition (sparse tape).
 * `writtenAt` marks the cell the last transition wrote to.
 */
export function TapeView({ tape, head, blank, writtenAt }: { tape: TapeSnapshot; head: number; blank: string; writtenAt: number | null }) {
  const cells: { pos: number; symbol: string }[] = [];
  for (let pos = head - WINDOW; pos <= head + WINDOW; pos++) {
    const i = pos - tape.origin;
    cells.push({ pos, symbol: i >= 0 && i < tape.cells.length ? (tape.cells[i] as string) : blank });
  }
  return (
    <div className="overflow-x-auto pb-1" aria-label={`Tape, head at cell ${head}`}>
      <div className="inline-flex min-w-full items-end justify-center gap-0.5">
        {tape.clippedLeft && <span className="self-center px-1 text-slate-500">…</span>}
        {cells.map(({ pos, symbol }) => {
          const isHead = pos === head;
          const isBlank = symbol === blank;
          return (
            <div key={pos} className="flex w-9 shrink-0 flex-col items-center">
              <div className={cn('h-5 text-sm leading-5 text-accent', !isHead && 'invisible')} aria-hidden>
                ▼
              </div>
              <div
                className={cn(
                  'flex h-10 w-9 items-center justify-center rounded-sm border font-mono text-base',
                  isHead ? 'border-accent bg-accent/20 text-accent ring-2 ring-accent/50' : 'border-ink-500 bg-ink-900',
                  isBlank && !isHead && 'text-slate-600',
                  pos === writtenAt && !isHead && 'border-warn/70 bg-warn/10 text-warn',
                  pos === writtenAt && isHead && 'border-warn',
                )}
                title={`cell ${pos}${pos === writtenAt ? ' (just written)' : ''}`}
              >
                {symbol}
              </div>
              <div className={cn('mt-0.5 font-mono text-[10px]', isHead ? 'text-accent' : 'text-slate-600')}>{pos}</div>
            </div>
          );
        })}
        {tape.clippedRight && <span className="self-center px-1 text-slate-500">…</span>}
      </div>
    </div>
  );
}

export function TmTransitionTable({ def, activeId }: { def: TmDefinition; activeId: string | null }) {
  if (def.transitions.length === 0) return <p className="text-sm text-slate-400">This machine has no transitions.</p>;
  return (
    <div className="max-h-72 overflow-auto">
      <table className="w-full min-w-[420px] border-collapse text-left">
        <thead className="sticky top-0 bg-ink-850">
          <tr>
            {['id', 'state', 'read', 'next', 'write', 'move'].map((h) => (
              <th key={h} className="th">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {def.transitions.map((t) => (
            <tr key={t.id} className={cn('border-t border-ink-700', t.id === activeId && 'bg-accent/15 text-accent')} title={tmTransitionFull(t)}>
              <td className="td text-slate-500">{t.id}</td>
              <td className="td">{t.from}</td>
              <td className="td">{t.read}</td>
              <td className="td">{t.to}</td>
              <td className="td">{t.write}</td>
              <td className="td">
                {MOVE_ARROW[t.move]} {t.move}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TmHistory({ configs, index, onJump }: { configs: TmConfiguration[]; index: number; onJump: (i: number) => void }) {
  return (
    <ol className="max-h-64 overflow-auto font-mono text-xs">
      {configs.map((c, i) => (
        <li key={`${c.step}-${i}`}>
          <button onClick={() => onJump(i)} className={cn('flex w-full items-baseline gap-2 border-l-2 px-2 py-1 text-left hover:bg-ink-800', i === index ? 'border-accent bg-accent/10' : 'border-transparent')}>
            <span className="w-10 shrink-0 text-right text-slate-500">{c.step}</span>
            <span className="text-slate-100">
              {c.state} @ {c.head}
            </span>
            <span className="ml-auto shrink-0 text-slate-500">{c.applied ? `${c.applied.id}: ${c.applied.read}→${c.applied.write},${c.applied.move}` : 'start'}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export function BlankHint({ blank }: { blank: string }) {
  return (
    <span className="text-xs text-slate-500">
      <Term k="blank">blank</Term> = <code className="text-slate-300">{blank}</code> · <Term k="twoWay">tape extends both ways</Term>
    </span>
  );
}
