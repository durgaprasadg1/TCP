import { ChevronDown, ChevronRight, ExternalLink, FlaskConical, Play } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EXECUTION_STATUSES } from '@cw/core';
import type { ExecutionStatus, TestOutcome, TestResult } from '@cw/core';
import { Card, EmptyState, ErrorBanner, PageHeader, Spinner, Stat, StatusBadge } from '../components/ui';
import { useExamples } from '../hooks/useExamples';
import { api, errorMessage } from '../lib/api';
import type { CustomTestCase, TestRunResponse } from '../lib/api';
import { cn } from '../lib/cn';
import { listSaved } from '../lib/storage';

const OUTCOME_STYLE: Record<TestOutcome, string> = {
  PASS: 'border-ok/50 bg-ok/10 text-ok',
  FAIL: 'border-bad/50 bg-bad/10 text-bad',
  INCONCLUSIVE: 'border-warn/50 bg-warn/10 text-warn',
};

function OutcomeBadge({ outcome }: { outcome: TestOutcome }) {
  return <span className={cn('rounded-md border px-2 py-0.5 text-xs font-semibold', OUTCOME_STYLE[outcome])}>{outcome}</span>;
}

function Dashboard({ summary }: { summary: TestRunResponse['summary'] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-live="polite">
      <Stat label="Total" value={summary.total} />
      <div className="rounded-md border border-ok/40 bg-ok/10 px-3 py-2">
        <div className="text-[11px] uppercase tracking-wider text-ok/80">Passed</div>
        <div className="font-mono text-base text-ok">{summary.passed}</div>
      </div>
      <div className={cn('rounded-md border px-3 py-2', summary.failed > 0 ? 'border-bad/50 bg-bad/10' : 'border-ink-700 bg-ink-900')}>
        <div className={cn('text-[11px] uppercase tracking-wider', summary.failed > 0 ? 'text-bad/80' : 'text-slate-500')}>Failed</div>
        <div className={cn('font-mono text-base', summary.failed > 0 ? 'text-bad' : 'text-slate-100')}>{summary.failed}</div>
      </div>
      <div className={cn('rounded-md border px-3 py-2', summary.inconclusive > 0 ? 'border-warn/50 bg-warn/10' : 'border-ink-700 bg-ink-900')}>
        <div className={cn('text-[11px] uppercase tracking-wider', summary.inconclusive > 0 ? 'text-warn/80' : 'text-slate-500')}>Inconclusive</div>
        <div className={cn('font-mono text-base', summary.inconclusive > 0 ? 'text-warn' : 'text-slate-100')}>{summary.inconclusive}</div>
      </div>
    </div>
  );
}

function ResultsTable({ results }: { results: TestResult[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  if (results.length === 0) return <EmptyState title="No test cases match the filters." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-left">
        <thead>
          <tr>
            <th className="th w-8" />
            <th className="th">Result</th>
            <th className="th">Machine</th>
            <th className="th">Category</th>
            <th className="th">Input</th>
            <th className="th">Expected</th>
            <th className="th">Actual</th>
            <th className="th">Steps</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => {
            const isOpen = open.has(r.testId);
            const builtinMachine = !r.machineId.startsWith('custom');
            return (
              <Fragment key={r.testId}>
                <tr className={cn('border-t border-ink-700', r.outcome !== 'PASS' && 'bg-ink-800/60')}>
                  <td className="p-1">
                    <button className="rounded p-1 text-slate-400 hover:bg-ink-700" onClick={() => toggle(r.testId)} aria-expanded={isOpen} aria-label={`${isOpen ? 'Hide' : 'Show'} explanation for ${r.testId}`}>
                      {isOpen ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                    </button>
                  </td>
                  <td className="p-2">
                    <OutcomeBadge outcome={r.outcome} />
                  </td>
                  <td className="td text-xs text-slate-300">{r.machineId}</td>
                  <td className="p-2 text-xs text-slate-400">{r.category}</td>
                  <td className="td max-w-[14rem] truncate text-slate-100" title={r.input}>
                    {r.input === '' ? 'ε' : r.input}
                  </td>
                  <td className="p-2">
                    <StatusBadge status={r.expected} />
                  </td>
                  <td className="p-2">
                    <StatusBadge status={r.actual} />
                  </td>
                  <td className="td text-slate-400">{r.steps ?? '–'}</td>
                </tr>
                {isOpen && (
                  <tr className="bg-ink-900">
                    <td />
                    <td colSpan={7} className="px-2 pb-3 pt-1 text-sm">
                      <p className="text-slate-300">{r.description}</p>
                      <p className="mt-1 text-slate-400">{r.explanation}</p>
                      {builtinMachine && (
                        <Link className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline" to={`/${r.machineKind === 'PDA' ? 'pda' : 'tm'}?m=b:${r.machineId}&input=${encodeURIComponent(r.input)}&run=1`}>
                          Open this execution in the laboratory <ExternalLink className="h-3 w-3" aria-hidden />
                        </Link>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** One case per line: `input | EXPECTED`. An empty input or ε means the empty string. */
function parseCases(text: string): { cases: CustomTestCase[]; errors: string[] } {
  const cases: CustomTestCase[] = [];
  const errors: string[] = [];
  text.split('\n').forEach((raw, i) => {
    if (raw.trim() === '') return;
    const bar = raw.lastIndexOf('|');
    if (bar < 0) {
      errors.push(`Line ${i + 1}: use "input | ACCEPTED" (or REJECTED, INCONCLUSIVE, INVALID_MACHINE).`);
      return;
    }
    const input = raw.slice(0, bar).trim();
    const expected = raw.slice(bar + 1).trim().toUpperCase() as ExecutionStatus;
    if (!EXECUTION_STATUSES.includes(expected)) {
      errors.push(`Line ${i + 1}: "${raw.slice(bar + 1).trim()}" is not one of ${EXECUTION_STATUSES.join(', ')}.`);
      return;
    }
    cases.push({ input: input === 'ε' ? '' : input, expected });
  });
  return { cases, errors };
}

const FILTERS: (TestOutcome | 'ALL')[] = ['ALL', 'PASS', 'FAIL', 'INCONCLUSIVE'];

export default function TestRunner() {
  const { machines } = useExamples();
  const [run, setRun] = useState<TestRunResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState<TestOutcome | 'ALL'>('ALL');
  const [kindFilter, setKindFilter] = useState<'ALL' | 'PDA' | 'TM'>('ALL');
  const [category, setCategory] = useState('ALL');

  const [customSource, setCustomSource] = useState('');
  const [customText, setCustomText] = useState('aabb | ACCEPTED\naab | REJECTED\n | REJECTED');
  const [customRun, setCustomRun] = useState<TestRunResponse | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const [customBusy, setCustomBusy] = useState(false);

  const saved = useMemo(() => listSaved(), []);

  const runAll = async () => {
    setBusy(true);
    setError(null);
    try {
      setRun(await api.runTests({}));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void runAll();
  }, []);

  const categories = useMemo(() => ['ALL', ...[...new Set((run?.results ?? []).map((r) => r.category))]], [run]);
  const shown = useMemo(
    () => (run?.results ?? []).filter((r) => (outcomeFilter === 'ALL' || r.outcome === outcomeFilter) && (kindFilter === 'ALL' || r.machineKind === kindFilter) && (category === 'ALL' || r.category === category)),
    [run, outcomeFilter, kindFilter, category],
  );

  const options = [
    ...machines.map((m) => ({ value: `b:${m.id}`, label: `${m.kind} · ${m.name}` })),
    ...saved.map((s) => ({ value: `s:${s.id}`, label: `${s.kind} · ${s.name} (saved)` })),
  ];
  const source = customSource || options[0]?.value || '';

  const runCustom = async () => {
    const def = source.startsWith('b:') ? machines.find((m) => `b:${m.id}` === source)?.definition : saved.find((s) => `s:${s.id}` === source)?.definition;
    if (!def) {
      setCustomError('Choose a machine first.');
      return;
    }
    const { cases, errors } = parseCases(customText);
    if (errors.length > 0 || cases.length === 0) {
      setCustomError(errors.length > 0 ? errors.join(' ') : 'Add at least one test case.');
      return;
    }
    setCustomBusy(true);
    setCustomError(null);
    try {
      setCustomRun(await api.runCustomTests(def.kind, def, cases));
    } catch (e) {
      setCustomError(errorMessage(e));
    } finally {
      setCustomBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Test Runner"
        subtitle="Every case below is executed on the API's engines when you press Run: the expected result comes from the test case, the actual result only from the machine. A case that hits a resource budget is reported as inconclusive, not as a pass or a fail."
      >
        <button className="btn btn-primary" onClick={() => void runAll()} disabled={busy}>
          <Play className="h-4 w-4" aria-hidden /> {busy ? 'Running…' : 'Run all tests'}
        </button>
      </PageHeader>

      {error && <ErrorBanner message={error} onRetry={() => void runAll()} />}
      {!run && !error && <Spinner label="Running the built-in suite…" />}

      {run && (
        <Card title="Built-in suite">
          <div className="space-y-4">
            <Dashboard summary={run.summary} />
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div role="group" aria-label="Filter by result" className="flex overflow-hidden rounded-md border border-ink-500">
                {FILTERS.map((f) => (
                  <button key={f} aria-pressed={outcomeFilter === f} onClick={() => setOutcomeFilter(f)} className={cn('px-3 py-1 text-xs font-medium', outcomeFilter === f ? 'bg-accent/20 text-accent' : 'bg-ink-800 text-slate-300 hover:bg-ink-700')}>
                    {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
              <select className="input !w-auto" value={kindFilter} onChange={(e) => setKindFilter(e.target.value as 'ALL' | 'PDA' | 'TM')} aria-label="Filter by machine type">
                <option value="ALL">PDA and TM</option>
                <option value="PDA">PDA only</option>
                <option value="TM">TM only</option>
              </select>
              <select className="input !w-auto max-w-[16rem]" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === 'ALL' ? 'All categories' : c}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-500">
                Showing {shown.length} of {run.results.length}
              </span>
            </div>
            <ResultsTable results={shown} />
          </div>
        </Card>
      )}

      <Card
        title={
          <span className="inline-flex items-center gap-1.5">
            <FlaskConical className="h-4 w-4" aria-hidden /> Test your own machine
          </span>
        }
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="custom-machine">
                Machine
              </label>
              <select id="custom-machine" className="input" value={source} onChange={(e) => setCustomSource(e.target.value)}>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="custom-cases">
                Cases, one per line: <code>input | EXPECTED</code>
              </label>
              <textarea id="custom-cases" className="input h-32" value={customText} onChange={(e) => setCustomText(e.target.value)} spellCheck={false} />
              <p className="mt-1 text-[11px] text-slate-500">EXPECTED is ACCEPTED, REJECTED, INCONCLUSIVE or INVALID_MACHINE. Leave the input empty (or ε) for the empty string.</p>
            </div>
            <button className="btn btn-primary" onClick={() => void runCustom()} disabled={customBusy || options.length === 0}>
              <Play className="h-4 w-4" aria-hidden /> {customBusy ? 'Running…' : 'Run these cases'}
            </button>
            {customError && <ErrorBanner message={customError} />}
          </div>
          <div>
            {customRun ? (
              <div className="space-y-3">
                <Dashboard summary={customRun.summary} />
                <ResultsTable results={customRun.results} />
              </div>
            ) : (
              <EmptyState title="No custom run yet">Results appear here with the real verdict of the engine for each case.</EmptyState>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
