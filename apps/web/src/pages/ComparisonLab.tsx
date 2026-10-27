import { ExternalLink, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ExecutionStatus, MachineEntry } from '@cw/core';
import { Card, ErrorBanner, PageHeader, Spinner, StatusBadge, Term } from '../components/ui';
import { useExamples } from '../hooks/useExamples';
import { api, errorMessage } from '../lib/api';
import { cn } from '../lib/cn';

const COLUMNS = [
  { id: 'pda-anbn', title: 'PDA for L1', note: 'one stack' },
  { id: 'tm-anbn', title: 'TM for L1', note: 'tape marking' },
  { id: 'tm-anbncn', title: 'TM for L2', note: 'tape marking' },
  { id: 'pda-anbn-cstar', title: 'PDA attempt at L2', note: 'one stack, fails' },
] as const;

const DEFAULT_INPUTS = ['ab', 'aabb', 'aabbc', 'abc', 'aabbcc', 'aaabbbccc', 'aabbccc', 'ba'];

interface Cell {
  status: ExecutionStatus;
  steps: number | null;
}

type Grid = Record<string, Record<string, Cell>>; // input -> machine id -> cell

async function runCell(entry: MachineEntry, input: string): Promise<Cell> {
  if (entry.kind === 'PDA') {
    const r = await api.executePda(entry.definition, input, { stopOnAccept: true });
    return { status: r.status, steps: r.status === 'INVALID_MACHINE' ? null : r.steps };
  }
  const r = await api.executeTm(entry.definition, input, {});
  return { status: r.status, steps: r.status === 'INVALID_MACHINE' ? null : r.steps };
}

export default function ComparisonLab() {
  const { get, loading, error, reload } = useExamples();
  const [inputs, setInputs] = useState<string[]>(DEFAULT_INPUTS);
  const [grid, setGrid] = useState<Grid>({});
  const [busy, setBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [cost, setCost] = useState<{ n: number; tm: number | null; pda: number | null }[]>([]);

  const entries = useMemo(() => COLUMNS.map((c) => get(c.id)), [get]);
  const ready = entries.every((e) => e !== undefined);

  const compute = useCallback(
    async (list: string[]) => {
      const defined = entries.filter((e): e is MachineEntry => e !== undefined);
      if (defined.length !== COLUMNS.length) return;
      setBusy(true);
      setRunError(null);
      try {
        const rows = await Promise.all(
          list.map(async (input) => {
            const cells = await Promise.all(defined.map((e) => runCell(e, input)));
            return [input, Object.fromEntries(defined.map((e, i) => [e.id, cells[i] as Cell]))] as const;
          }),
        );
        setGrid((g) => ({ ...g, ...Object.fromEntries(rows) }));
      } catch (e) {
        setRunError(errorMessage(e));
      } finally {
        setBusy(false);
      }
    },
    [entries],
  );

  useEffect(() => {
    if (ready) void compute(DEFAULT_INPUTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Step counts for a^n b^n c^n (TM) against a^n b^n (PDA), measured by the engines.
  useEffect(() => {
    const tmE = get('tm-anbncn');
    const pdaE = get('pda-anbn');
    if (!tmE || !pdaE || tmE.kind !== 'TM' || pdaE.kind !== 'PDA') return;
    let cancelled = false;
    void (async () => {
      try {
        const ns = [1, 2, 3, 4, 6, 8, 12];
        const rows = await Promise.all(
          ns.map(async (n) => {
            const [t, p] = await Promise.all([api.executeTm(tmE.definition, 'a'.repeat(n) + 'b'.repeat(n) + 'c'.repeat(n), {}), api.executePda(pdaE.definition, 'a'.repeat(n) + 'b'.repeat(n), {})]);
            return { n, tm: t.status === 'ACCEPTED' ? t.steps : null, pda: p.status === 'ACCEPTED' ? p.steps : null };
          }),
        );
        if (!cancelled) setCost(rows);
      } catch {
        /* the main error banner covers API outages */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [get]);

  const addInput = () => {
    const s = draft === 'ε' ? '' : draft;
    if (inputs.includes(s)) {
      setDraft('');
      return;
    }
    const next = [...inputs, s];
    setInputs(next);
    setDraft('');
    void compute([s]);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Comparison Laboratory"
        subtitle={
          <>
            Two languages: <code className="text-accent">L1 = {'{'} aⁿbⁿ | n ≥ 1 {'}'}</code> and <code className="text-accent">L2 = {'{'} aⁿbⁿcⁿ | n ≥ 1 {'}'}</code>. Everything in the table below is
            produced by running the machines on the API.
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="1 · A single-stack PDA recognizes L1">
          <p className="text-sm text-slate-300">
            The stack is a perfect counter for L1: push one marker per <code>a</code>, pop one per <code>b</code>, and accept when the markers run out exactly as the input does. The{' '}
            <Link className="text-accent underline" to="/pda?m=b:pda-anbn&input=aaabbb&run=1">
              built-in PDA
            </Link>{' '}
            does this with five transitions.
          </p>
        </Card>
        <Card title="2 · No single-stack PDA recognizes L2">
          <p className="text-sm text-slate-300">
            L2 is <strong>not context-free</strong> (this follows from the pumping lemma for context-free languages), and every language accepted by a nondeterministic PDA is context-free, so no PDA with one stack accepts L2, however it is designed. The intuition: popping the a's to compare them with the b's destroys the count that the c's would need. The attempt in the last column does exactly that, and so it accepts <code>aabbc</code>, which is not in L2.
          </p>
        </Card>
        <Card title="3 · A Turing machine recognizes both">
          <p className="text-sm text-slate-300">
            A TM can rewrite its tape, so it can mark one <code>a</code>, one <code>b</code> and one <code>c</code> per round and rewind. The{' '}
            <Link className="text-accent underline" to="/tm?m=b:tm-anbncn&input=aabbcc&run=1">
              a<sup>n</sup>b<sup>n</sup>c<sup>n</sup> machine
            </Link>{' '}
            and the{' '}
            <Link className="text-accent underline" to="/tm?m=b:tm-anbn&input=aaabbb&run=1">
              a<sup>n</sup>b<sup>n</sup> machine
            </Link>{' '}
            both halt on every input, so they are <Term k="decider">deciders</Term>. The price is time: marking needs a number of steps that grows roughly quadratically in n (see the table below), whereas the PDA is linear.
          </p>
        </Card>
        <Card title="4 · Languages versus arbitrary machines">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-300">
            <li>
              The statements above are about <em>languages</em>: the class of languages PDAs recognize (context-free) is strictly contained in the class of decidable languages that TMs decide. They say nothing like “a TM is faster than a PDA on every input”.
            </li>
            <li>
              Running a <em>given</em> machine is a different problem. For a TM, no algorithm can decide whether an arbitrary machine halts, so a step limit can only ever report <Term k="inconclusive">INCONCLUSIVE</Term>: a bounded simulation proves nothing about non-termination.
            </li>
            <li>
              For a PDA, membership is decidable in principle, but this simulator explores configurations directly and a PDA that pushes forever on ε-moves has infinitely many of them, so it can also end INCONCLUSIVE within its budget.
            </li>
          </ul>
        </Card>
      </div>

      <Card
        title="Verdict matrix (live executions)"
        actions={busy ? <Spinner label="Running…" /> : undefined}
      >
        {loading && <Spinner label="Loading machines…" />}
        {error && <ErrorBanner message={error} onRetry={reload} />}
        {runError && <ErrorBanner message={runError} />}
        {ready && (
          <>
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <div className="w-56">
                <label className="label" htmlFor="cmp-input">
                  Add an input string
                </label>
                <input
                  id="cmp-input"
                  className="input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="e.g. aaabbbcc"
                  spellCheck={false}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addInput();
                  }}
                />
              </div>
              <button className="btn" onClick={addInput} disabled={busy}>
                <Plus className="h-4 w-4" aria-hidden /> Run on all four machines
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr>
                    <th className="th">Input</th>
                    {COLUMNS.map((c) => (
                      <th key={c.id} className="th">
                        {c.title}
                        <div className="text-[10px] font-normal normal-case tracking-normal text-slate-500">{c.note}</div>
                      </th>
                    ))}
                    <th className="th">Check</th>
                  </tr>
                </thead>
                <tbody>
                  {inputs.map((input) => {
                    const row = grid[input];
                    const attempt = row?.['pda-anbn-cstar'];
                    const truth = row?.['tm-anbncn'];
                    const l1p = row?.['pda-anbn'];
                    const l1t = row?.['tm-anbn'];
                    const disagree = attempt && truth && attempt.status !== truth.status;
                    const l1disagree = l1p && l1t && l1p.status !== l1t.status;
                    return (
                      <tr key={input === '' ? '__empty' : input} className="border-t border-ink-700">
                        <td className="td text-slate-100">{input === '' ? 'ε' : input}</td>
                        {COLUMNS.map((c) => {
                          const cell = row?.[c.id];
                          const mode = c.id.startsWith('pda') ? 'pda' : 'tm';
                          return (
                            <td key={c.id} className={cn('p-2 align-top', c.id === 'pda-anbn-cstar' && disagree && 'bg-warn/10')}>
                              {cell ? (
                                <div className="space-y-0.5">
                                  <StatusBadge status={cell.status} />
                                  <div className="font-mono text-[11px] text-slate-500">
                                    {cell.steps === null ? '' : `${cell.steps} step${cell.steps === 1 ? '' : 's'} · `}
                                    <Link className="inline-flex items-center gap-0.5 text-accent hover:underline" to={`/${mode}?m=b:${c.id}&input=${encodeURIComponent(input)}&run=1`}>
                                      trace <ExternalLink className="h-3 w-3" aria-hidden />
                                    </Link>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-600">…</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-2 text-xs align-top">
                          {disagree && <span className="text-warn">The failed PDA attempt and the L2 TM disagree here.</span>}
                          {l1disagree && <span className="text-bad">The two L1 machines disagree: a bug in one of them!</span>}
                          {!disagree && !l1disagree && row && <span className="text-slate-500">machines agree</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Card title="Measured cost: steps on accepted words aⁿbⁿcⁿ (TM) and aⁿbⁿ (PDA)">
        {cost.length === 0 ? (
          <Spinner label="Measuring…" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-left">
              <thead>
                <tr>
                  <th className="th">n</th>
                  <th className="th">PDA steps (L1, input length 2n)</th>
                  <th className="th">TM steps (L2, input length 3n)</th>
                  <th className="th">TM steps ÷ n²</th>
                </tr>
              </thead>
              <tbody>
                {cost.map((r) => (
                  <tr key={r.n} className="border-t border-ink-700">
                    <td className="td">{r.n}</td>
                    <td className="td">{r.pda ?? '–'}</td>
                    <td className="td">{r.tm ?? '–'}</td>
                    <td className="td text-slate-400">{r.tm === null ? '–' : (r.tm / (r.n * r.n)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500">These numbers describe these two particular machines, not all PDAs and TMs.</p>
      </Card>
    </div>
  );
}
