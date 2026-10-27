import { ArrowRight, Boxes, Layers, ListChecks, Network, Play, Server } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, ErrorBanner, PageHeader, Spinner, Term } from '../components/ui';
import { useExamples } from '../hooks/useExamples';
import { API_BASE_URL, api } from '../lib/api';

function ApiStatus() {
  const [state, setState] = useState<'checking' | 'up' | 'down'>('checking');
  useEffect(() => {
    let cancelled = false;
    api
      .health()
      .then(() => !cancelled && setState('up'))
      .catch(() => !cancelled && setState('down'));
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-ink-600 bg-ink-900 px-2.5 py-1 text-xs text-slate-300" role="status">
      <Server className="h-3.5 w-3.5" aria-hidden />
      API {API_BASE_URL}:
      <span className={state === 'up' ? 'text-ok' : state === 'down' ? 'text-bad' : 'text-slate-400'}>{state === 'up' ? 'online' : state === 'down' ? 'unreachable' : 'checking…'}</span>
    </span>
  );
}

export default function Overview() {
  const { machines, loading, error, reload } = useExamples();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Computation Workbench"
        subtitle={
          <>
            A laboratory for the Theory of Computation. Run real <Term k="pda">pushdown automata</Term> and <Term k="tm">Turing machines</Term>, step through every{' '}
            <Term k="configuration">configuration</Term>, build your own machines and see why an input is accepted, rejected or <Term k="inconclusive">inconclusive</Term>.
          </>
        }
      >
        <ApiStatus />
      </PageHeader>

      <section aria-labelledby="launch">
        <h2 id="launch" className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Launch a built-in example
        </h2>
        {loading && <Spinner label="Loading examples from the API…" />}
        {error && <ErrorBanner message={error} onRetry={reload} />}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {machines.map((m) => {
            const lab = m.kind === 'PDA' ? 'pda' : 'tm';
            return (
              <Card key={m.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-accent">{m.kind === 'PDA' ? 'Pushdown automaton' : 'Turing machine'}</div>
                    <h3 className="mt-0.5 font-medium text-black">{m.name}</h3>
                  </div>
                  <Link className="btn btn-primary shrink-0" to={`/${lab}?m=b:${m.id}&input=${encodeURIComponent(m.defaultInput)}&run=1`}>
                    <Play className="h-4 w-4" aria-hidden /> Run
                  </Link>
                </div>
                {m.language && <p className="mt-1 font-mono text-xs text-slate-300">{m.language}</p>}
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{m.description}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Example input: <code className="text-slate-300">{m.defaultInput === '' ? 'ε' : m.defaultInput}</code>
                </p>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-black" aria-label="Where to go next">
        {[
          { to: '/pda', icon: Layers, title: 'PDA Laboratory', text: 'Stack, input and every nondeterministic branch, step by step.' },
          { to: '/tm', icon: Boxes, title: 'Turing Machine Laboratory', text: 'Tape, head and the exact transition applied at each step.' },
          { to: '/builder', icon: Network, title: 'Machine Builder', text: 'Edit transition tables, validate, save, import and export JSON.' },
          { to: '/tests', icon: ListChecks, title: 'Test Runner', text: 'Edge-case suite executed live against the engines.' },
        ].map(({ to, icon: Icon, title, text }) => (
          <Link key={to} to={to} className="card group flex flex-col gap-1 p-4 transition-colors hover:border-accent/60">
            <Icon className="h-5 w-5 text-accent" aria-hidden />
            <span className="font-medium text-black">{title}</span>
            <span className="text-sm text-slate-400">{text}</span>
            <span className="mt-1 inline-flex items-center gap-1 text-xs text-accent opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              Open <ArrowRight className="h-3 w-3" aria-hidden />
            </span>
          </Link>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="How it works">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-300">
            <li>
              The engines live in one shared package. The Express API runs them; this app only displays the traces it returns, and never applies a transition or decides acceptance itself.
            </li>
            <li>
              The PDA engine follows <em>every</em> applicable transition (<Term k="nondeterminism">nondeterminism</Term>), prunes repeated configurations and answers INCONCLUSIVE, never REJECTED, if its budget runs out.
            </li>
            <li>
              The Turing machine engine uses a sparse <Term k="twoWay">two-way infinite tape</Term>. A missing transition is an <Term k="implicitReject">implicit reject</Term>; reaching the step limit is INCONCLUSIVE.
            </li>
          </ul>
        </Card>
        <Card title="Compare PDAs and Turing machines">
          <p className="text-sm text-slate-300">
            A single stack can count for <code className="text-accent">aⁿbⁿ</code> but not for <code className="text-accent">aⁿbⁿcⁿ</code>; a tape can do both. The{' '}
            <Link to="/compare" className="text-accent underline">
              Comparison Laboratory
            </Link>{' '}
            runs the machines side by side and explains what is, and is not, being claimed.
          </p>
        </Card>
      </div>
    </div>
  );
}
