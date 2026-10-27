import { AlertTriangle, CheckCircle2, HelpCircle, Info, Loader2, OctagonX, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ExecutionStatus, ValidationIssue } from '@cw/core';
import { cn } from '../lib/cn';
import { GLOSSARY } from '../lib/glossary';

/** Inline term with an accessible tooltip (hover or keyboard focus). */
export function Term({ k, children }: { k: keyof typeof GLOSSARY; children?: ReactNode }) {
  const entry = GLOSSARY[k];
  if (!entry) return <>{children}</>;
  return (
    <span className="group relative inline-block cursor-help border-b border-dotted border-slate-500" tabIndex={0} aria-describedby={`tip-${String(k)}`}>
      {children ?? entry.term}
      <span
        id={`tip-${String(k)}`}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-30 mb-1.5 hidden w-64 max-w-[calc(100vw-2rem)] rounded-md border border-ink-500 bg-ink-950 p-2 text-left text-xs font-normal normal-case leading-snug tracking-normal text-slate-200 shadow-xl group-hover:block group-focus:block"
      >
        <strong className="mb-0.5 block text-accent">{entry.term}</strong>
        {entry.text}
      </span>
    </span>
  );
}

const STATUS_STYLE: Record<ExecutionStatus, { cls: string; label: string; icon: ReactNode }> = {
  ACCEPTED: { cls: 'border-ok/50 bg-ok/10 text-ok', label: 'ACCEPTED', icon: <CheckCircle2 className="h-4 w-4" aria-hidden /> },
  REJECTED: { cls: 'border-bad/50 bg-bad/10 text-bad', label: 'REJECTED', icon: <XCircle className="h-4 w-4" aria-hidden /> },
  INCONCLUSIVE: { cls: 'border-warn/50 bg-warn/10 text-warn', label: 'INCONCLUSIVE', icon: <HelpCircle className="h-4 w-4" aria-hidden /> },
  INVALID_MACHINE: { cls: 'border-slate-500/60 bg-slate-500/10 text-slate-300', label: 'INVALID MACHINE', icon: <OctagonX className="h-4 w-4" aria-hidden /> },
};

export function StatusBadge({ status, className }: { status: ExecutionStatus; className?: string }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold tracking-wide', s.cls, className)}>
      {s.icon}
      {s.label}
    </span>
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('card', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-ink-700 px-3 py-2">
          <h3 className="card-title">{title}</h3>
          {actions}
        </header>
      )}
      <div className="p-3">{children}</div>
    </section>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-400" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label ?? 'Loading…'}
    </span>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex-1">{message}</div>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-ink-500 p-6 text-center">
      <p className="font-medium text-slate-300">{title}</p>
      {children && <p className="mt-1 text-sm text-slate-400">{children}</p>}
    </div>
  );
}

const ISSUE_STYLE = {
  error: { cls: 'border-bad/40 bg-bad/10 text-bad', icon: <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />, label: 'Error' },
  warning: { cls: 'border-warn/40 bg-warn/10 text-warn', icon: <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />, label: 'Warning' },
  info: { cls: 'border-accent/30 bg-accent/10 text-accent', icon: <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />, label: 'Info' },
} as const;

export function IssueList({ issues, emptyText }: { issues: ValidationIssue[]; emptyText?: string }) {
  if (issues.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-ok">
        <CheckCircle2 className="h-4 w-4" aria-hidden /> {emptyText ?? 'No problems found.'}
      </p>
    );
  }
  const order = { error: 0, warning: 1, info: 2 } as const;
  const sorted = [...issues].sort((a, b) => order[a.severity] - order[b.severity]);
  return (
    <ul className="space-y-1.5">
      {sorted.map((i, n) => {
        const s = ISSUE_STYLE[i.severity];
        return (
          <li key={`${i.code}-${n}`} className={cn('flex min-w-0 gap-2 rounded-md border px-2.5 py-1.5 text-sm', s.cls)}>
            {s.icon}
            <span className="min-w-0 break-words">
              <span className="sr-only">{s.label}: </span>
              {i.message}
              {i.path && <code className="ml-2 text-xs opacity-70">{i.path}</code>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function Stat({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-md border border-ink-700 bg-ink-900 px-3 py-2" title={hint}>
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-mono text-base text-slate-100">{value}</div>
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-black">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}
