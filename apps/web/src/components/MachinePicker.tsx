import { Card, Term } from './ui';
import type { LabMachine } from '../hooks/useLabMachine';
import type { ReactNode } from 'react';

interface Props {
  lab: LabMachine<unknown>;
  facts: ReactNode;
}

/** Machine selector with the formal language and one-click sample inputs. */
export function MachinePicker({ lab, facts }: Props) {
  const groups = ['Built-in', 'Saved in this browser'] as const;
  return (
    <Card title="Machine">
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <div>
          <label className="label" htmlFor="machine-select">
            Choose a machine
          </label>
          <select id="machine-select" className="input" value={lab.selected} onChange={(e) => lab.select(e.target.value)}>
            {groups.map((g) => {
              const opts = lab.options.filter((o) => o.group === g);
              return opts.length === 0 ? null : (
                <optgroup key={g} label={g}>
                  {opts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
          {lab.language && <p className="mt-2 font-mono text-sm text-accent">{lab.language}</p>}
        </div>
        <div className="space-y-2 text-sm">
          {lab.description && <p className="text-slate-300">{lab.description}</p>}
          <p className="text-xs text-slate-400">{facts}</p>
          {(lab.samples.accepted.length > 0 || lab.samples.rejected.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-500">Try:</span>
              {lab.samples.accepted.map((s) => (
                <button key={`a-${s}`} className="rounded border border-ok/40 bg-ok/10 px-2 py-0.5 font-mono text-xs text-ok hover:bg-ok/20" onClick={() => lab.setInput(s)} title="In the language">
                  {s === '' ? 'ε' : s}
                </button>
              ))}
              {lab.samples.rejected.map((s) => (
                <button key={`r-${s}`} className="rounded border border-bad/40 bg-bad/10 px-2 py-0.5 font-mono text-xs text-bad hover:bg-bad/20" onClick={() => lab.setInput(s)} title="Not in the language">
                  {s === '' ? 'ε' : s}
                </button>
              ))}
              <span className="text-[11px] text-slate-500">
                green = <Term k="language">in the language</Term>, red = not
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
