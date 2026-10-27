import { Download, FilePlus2, FolderOpen, Save, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { validatePda, validateTm } from '@cw/core';
import type { MachineKind, PdaDefinition, TmDefinition, ValidationIssue } from '@cw/core';
import { StateDiagram } from '../components/StateDiagram';
import { Card, ErrorBanner, IssueList, PageHeader } from '../components/ui';
import { blankFor, deepClone, downloadJson, importDefinition } from '../features/machine-builder/definitions';
import { PdaEditor } from '../features/machine-builder/PdaEditor';
import { TmEditor } from '../features/machine-builder/TmEditor';
import { PdaWorkspace } from '../features/pda/PdaWorkspace';
import { TmWorkspace } from '../features/turing-machine/TmWorkspace';
import { useExamples } from '../hooks/useExamples';
import { api, errorMessage } from '../lib/api';
import type { ValidationReport } from '../lib/api';
import { cn } from '../lib/cn';
import { pdaGraph, tmGraph } from '../lib/graph';
import { deleteSaved, listSaved, loadDraft, saveDraft, saveMachine } from '../lib/storage';
import type { AnyDefinition, SavedMachine } from '../lib/storage';

type Notice = { tone: 'ok' | 'error'; text: string; issues?: ValidationIssue[] } | null;

export default function MachineBuilder() {
  const [params, setParams] = useSearchParams();
  const { get, machines } = useExamples();
  const kind: MachineKind = params.get('kind') === 'TM' ? 'TM' : 'PDA';

  const [drafts, setDrafts] = useState<Record<MachineKind, AnyDefinition>>(() => ({
    PDA: loadDraft('PDA') ?? blankFor('PDA'),
    TM: loadDraft('TM') ?? blankFor('TM'),
  }));
  const draft = drafts[kind];
  const [savedId, setSavedId] = useState<Record<MachineKind, string | undefined>>({ PDA: undefined, TM: undefined });
  const [saved, setSaved] = useState<SavedMachine[]>(() => listSaved());
  const [notice, setNotice] = useState<Notice>(null);
  const [serverReport, setServerReport] = useState<ValidationReport | null>(null);
  const [serverBusy, setServerBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [inputs, setInputs] = useState<Record<MachineKind, string>>({ PDA: '', TM: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  const setDraft = (d: AnyDefinition) => setDrafts((prev) => ({ ...prev, [d.kind]: d }));
  const switchKind = (k: MachineKind) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set('kind', k);
      n.delete('template');
      return n;
    });

  // Persist the working draft so a reload does not lose it.
  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  // Any edit makes a previous server report stale.
  useEffect(() => {
    setServerReport(null);
    setServerError(null);
  }, [draft]);

  // ?template=<built-in id> loads an editable copy of a built-in machine.
  const template = params.get('template');
  useEffect(() => {
    if (!template) return;
    const entry = get(template);
    if (!entry) return;
    setDrafts((prev) => ({ ...prev, [entry.kind]: { ...deepClone(entry.definition), name: `${entry.definition.name} (copy)` } }));
    setSavedId((s) => ({ ...s, [entry.kind]: undefined }));
    setInputs((i) => ({ ...i, [entry.kind]: entry.defaultInput }));
    setNotice({ tone: 'ok', text: `Loaded an editable copy of “${entry.name}”.` });
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set('kind', entry.kind);
      n.delete('template');
      return n;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, machines.length]);

  const localIssues = useMemo<ValidationIssue[]>(() => (draft.kind === 'PDA' ? validatePda(draft).issues : validateTm(draft).issues), [draft]);
  const hasErrors = localIssues.some((i) => i.severity === 'error');
  const graph = useMemo(() => (draft.kind === 'PDA' ? pdaGraph(draft) : tmGraph(draft)), [draft]);

  const validateOnServer = async () => {
    setServerBusy(true);
    setServerError(null);
    try {
      setServerReport(await api.validate(draft.kind, draft));
    } catch (e) {
      setServerError(errorMessage(e));
    } finally {
      setServerBusy(false);
    }
  };

  const save = () => {
    const entry = saveMachine(draft, savedId[kind]);
    if (!entry) {
      setNotice({ tone: 'error', text: 'Could not save: browser storage is unavailable or full.' });
      return;
    }
    setSavedId((s) => ({ ...s, [kind]: entry.id }));
    setSaved(listSaved());
    setNotice({ tone: 'ok', text: `Saved “${entry.name}” in this browser. It now appears in the laboratories.` });
  };

  const applyImport = (text: string, source: string) => {
    const r = importDefinition(text);
    if (!r.ok) {
      setNotice({ tone: 'error', text: `Could not import ${source}. Nothing was changed.`, issues: r.issues });
      return;
    }
    setDrafts((prev) => ({ ...prev, [r.definition.kind]: r.definition }));
    setSavedId((s) => ({ ...s, [r.definition.kind]: undefined }));
    if (r.definition.kind !== kind) switchKind(r.definition.kind);
    setNotice({ tone: 'ok', text: `Imported ${r.definition.kind} “${r.definition.name}” from ${source}.` });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1_000_000) {
      setNotice({ tone: 'error', text: 'That file is larger than 1 MB; refusing to import it.' });
      return;
    }
    applyImport(await file.text(), file.name);
    if (fileRef.current) fileRef.current.value = '';
  };

  const savedForKind = saved.filter((s) => s.kind === kind);
  const builtinsForKind = machines.filter((m) => m.kind === kind);

  return (
    <div>
      <PageHeader title="Machine Builder" subtitle="Define a machine in the transition table, validate it, watch the diagram follow your edits and run any input on the real engines." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Machine type" className="flex overflow-hidden rounded-md border border-ink-500">
          {(['PDA', 'TM'] as const).map((k) => (
            <button key={k} role="tab" aria-selected={kind === k} onClick={() => switchKind(k)} className={cn('px-4 py-1.5 text-sm font-medium', kind === k ? 'bg-accent/20 text-accent' : 'bg-ink-800 text-slate-300 hover:bg-ink-700')}>
              {k === 'PDA' ? 'Pushdown automaton' : 'Turing machine'}
            </button>
          ))}
        </div>

        <select
          className="input !w-auto max-w-full"
          aria-label="Start from a template"
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (v === '__blank') {
              setDraft(blankFor(kind));
              setSavedId((s) => ({ ...s, [kind]: undefined }));
              setInputs((i) => ({ ...i, [kind]: '' }));
            } else if (v.startsWith('b:')) {
              setParams((p) => {
                const n = new URLSearchParams(p);
                n.set('template', v.slice(2));
                return n;
              });
            } else if (v.startsWith('s:')) {
              const s = saved.find((m) => m.id === v.slice(2));
              if (s) {
                setDraft(deepClone(s.definition));
                setSavedId((x) => ({ ...x, [kind]: s.id }));
              }
            }
          }}
        >
          <option value="">Load…</option>
          <option value="__blank">New blank machine</option>
          {builtinsForKind.length > 0 && (
            <optgroup label="Copy of built-in">
              {builtinsForKind.map((m) => (
                <option key={m.id} value={`b:${m.id}`}>
                  {m.name}
                </option>
              ))}
            </optgroup>
          )}
          {savedForKind.length > 0 && (
            <optgroup label="Saved in this browser">
              {savedForKind.map((m) => (
                <option key={m.id} value={`s:${m.id}`}>
                  {m.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>

        <button className="btn btn-primary" onClick={save}>
          <Save className="h-4 w-4" aria-hidden /> Save
        </button>
        <button className="btn" onClick={() => downloadJson(draft)}>
          <Download className="h-4 w-4" aria-hidden /> Export JSON
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" aria-hidden /> Import JSON
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Import a machine JSON file" onChange={(e) => void onFile(e.target.files?.[0])} />
        <button
          className="btn"
          onClick={() => {
            setDraft(blankFor(kind));
            setSavedId((s) => ({ ...s, [kind]: undefined }));
          }}
        >
          <FilePlus2 className="h-4 w-4" aria-hidden /> New
        </button>
      </div>

      {notice && (
        <div className={cn('mb-4 rounded-md border p-3 text-sm', notice.tone === 'ok' ? 'border-ok/40 bg-ok/10 text-ok' : 'border-bad/40 bg-bad/10 text-bad')} role={notice.tone === 'error' ? 'alert' : 'status'}>
          <div className="flex items-start justify-between gap-2">
            <span>{notice.text}</span>
            <button className="text-xs underline" onClick={() => setNotice(null)}>
              dismiss
            </button>
          </div>
          {notice.issues && (
            <div className="mt-2">
              <IssueList issues={notice.issues} />
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        {draft.kind === 'PDA' ? <PdaEditor def={draft} onChange={setDraft} /> : <TmEditor def={draft} onChange={setDraft} />}

        <div className="grid gap-4 xl:grid-cols-2">
          <Card
            title={`Validation ${hasErrors ? `· ${localIssues.filter((i) => i.severity === 'error').length} error(s)` : '· valid'}`}
            actions={
              <button className="btn" onClick={() => void validateOnServer()} disabled={serverBusy}>
                <ShieldCheck className="h-4 w-4" aria-hidden /> {serverBusy ? 'Checking…' : 'Validate on server'}
              </button>
            }
          >
            <IssueList issues={localIssues} emptyText="The definition is valid and can be executed." />
            <p className="mt-2 text-xs text-slate-500">Nothing is changed automatically: fix each problem in the editor above.</p>
            {serverError && (
              <div className="mt-3">
                <ErrorBanner message={serverError} />
              </div>
            )}
            {serverReport && (
              <p className={cn('mt-3 rounded-md border px-2.5 py-1.5 text-sm', serverReport.valid ? 'border-ok/40 bg-ok/10 text-ok' : 'border-bad/40 bg-bad/10 text-bad')}>
                Server check: {serverReport.valid ? 'valid' : `${serverReport.issues.filter((i) => i.severity === 'error').length} error(s)`}
                {serverReport.summary ? ` · ${serverReport.summary.states} states, ${serverReport.summary.transitions} transitions` : ''}
              </p>
            )}
          </Card>

          <Card title="Saved in this browser">
            {savedForKind.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing saved yet. Use Save to keep this machine; it will also appear in the laboratory selectors.</p>
            ) : (
              <ul className="space-y-1.5">
                {savedForKind.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 rounded-md border border-ink-600 bg-ink-900 px-2.5 py-1.5 text-sm">
                    <span className="flex-1 truncate">
                      {m.name}
                      <span className="ml-2 text-xs text-slate-500">{new Date(m.savedAt).toLocaleString()}</span>
                    </span>
                    <button
                      className="btn !py-0.5"
                      onClick={() => {
                        setDraft(deepClone(m.definition));
                        setSavedId((s) => ({ ...s, [kind]: m.id }));
                      }}
                    >
                      <FolderOpen className="h-4 w-4" aria-hidden /> Load
                    </button>
                    <button
                      className="btn btn-danger !py-0.5"
                      aria-label={`Delete saved machine ${m.name}`}
                      onClick={() => {
                        deleteSaved(m.id);
                        setSaved(listSaved());
                        setSavedId((s) => (s[kind] === m.id ? { ...s, [kind]: undefined } : s));
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-slate-300">Paste JSON to import</summary>
              <textarea className="input mt-2 h-28" value={pasteText} onChange={(e) => setPasteText(e.target.value)} aria-label="Machine JSON" spellCheck={false} placeholder='{"kind": "PDA", ...}' />
              <button className="btn mt-2" disabled={pasteText.trim() === ''} onClick={() => applyImport(pasteText, 'pasted JSON')}>
                Import pasted JSON
              </button>
            </details>
          </Card>
        </div>

        <Card title="State diagram (updates as you edit)">
          <StateDiagram graph={graph} height={340} />
        </Card>

        <h2 className="pt-2 text-lg font-semibold text-white">Run this machine</h2>
        {hasErrors && <p className="text-sm text-warn">The machine has validation errors. You can still run it: the engine will answer INVALID_MACHINE and list them.</p>}
        {draft.kind === 'PDA' ? (
          <PdaWorkspace definition={draft as PdaDefinition} input={inputs.PDA} onInputChange={(s) => setInputs((i) => ({ ...i, PDA: s }))} />
        ) : (
          <TmWorkspace definition={draft as TmDefinition} input={inputs.TM} onInputChange={(s) => setInputs((i) => ({ ...i, TM: s }))} />
        )}
      </div>
    </div>
  );
}
