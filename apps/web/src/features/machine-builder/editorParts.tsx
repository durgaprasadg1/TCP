import { Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { parseSymbolList } from './definitions';

/** Space- or comma-separated symbol list. Keeps the raw text while typing and commits the parsed list. */
export function AlphabetField({ id, label, value, onChange, hint }: { id: string; label: string; value: string[]; onChange: (v: string[]) => void; hint?: string }) {
  const [text, setText] = useState(value.join(' '));
  useEffect(() => {
    const current = parseSymbolList(text);
    if (current.length !== value.length || current.some((s, i) => s !== value[i])) setText(value.join(' '));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        value={text}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseSymbolList(e.target.value));
        }}
      />
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

/** Adds and removes states. Removing a state keeps the transitions that mention it so validation can flag them. */
export function StatesEditor({ states, onChange }: { states: string[]; onChange: (s: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const name = draft.trim();
    if (name === '') return;
    onChange([...states, name]);
    setDraft('');
  };
  return (
    <div>
      <div className="label">States</div>
      <ul className="mb-2 flex flex-wrap gap-1.5">
        {states.map((s, i) => (
          <li key={`${s}-${i}`} className="flex items-center gap-1 rounded-md border border-ink-500 bg-ink-900 py-0.5 pl-2 pr-1 font-mono text-sm">
            {s}
            <button className="rounded p-0.5 text-slate-500 hover:bg-bad/20 hover:text-bad" onClick={() => onChange(states.filter((_, j) => j !== i))} aria-label={`Remove state ${s}`} title={`Remove ${s} (transitions that use it are kept and flagged as errors)`}>
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </li>
        ))}
        {states.length === 0 && <li className="text-sm text-slate-500">No states yet.</li>}
      </ul>
      <div className="flex gap-2">
        <input
          className="input"
          value={draft}
          placeholder="new state name"
          aria-label="New state name"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button className="btn" onClick={add} disabled={draft.trim() === ''}>
          <Plus className="h-4 w-4" aria-hidden /> Add
        </button>
      </div>
    </div>
  );
}

/** A set of checkboxes over the declared states. Unknown members stay visible so they can be removed. */
export function StateSetPicker({ legend, states, selected, onChange }: { legend: string; states: string[]; selected: string[]; onChange: (s: string[]) => void }) {
  const unknown = selected.filter((s) => !states.includes(s));
  return (
    <fieldset>
      <legend className="label">{legend}</legend>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {[...states, ...unknown].map((s) => (
          <label key={s} className="flex items-center gap-1.5 font-mono text-sm">
            <input type="checkbox" checked={selected.includes(s)} onChange={(e) => onChange(e.target.checked ? [...selected, s] : selected.filter((x) => x !== s))} />
            <span className={states.includes(s) ? '' : 'text-bad'}>{s}</span>
          </label>
        ))}
        {states.length === 0 && <span className="text-sm text-slate-500">Add states first.</span>}
      </div>
    </fieldset>
  );
}

export function StateSelect({ value, states, onChange, label }: { value: string; states: string[]; onChange: (v: string) => void; label: string }) {
  const unknown = !states.includes(value);
  return (
    <select className={`input !px-1.5 ${unknown ? 'border-bad' : ''}`} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      {unknown && <option value={value}>{value === '' ? '(choose)' : `${value} (unknown)`}</option>}
      {states.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

export function SymbolInput({ value, onChange, label, list, placeholder, wide }: { value: string; onChange: (v: string) => void; label: string; list?: string; placeholder?: string; wide?: boolean }) {
  return (
    <input
      className={`input !px-1.5 text-center ${wide ? '' : '!w-16'}`}
      value={value}
      list={list}
      placeholder={placeholder ?? 'ε'}
      aria-label={label}
      spellCheck={false}
      autoComplete="off"
      onChange={(e) => onChange(e.target.value === 'ε' ? '' : e.target.value)}
    />
  );
}

export function DeleteRowButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button className="btn btn-icon btn-danger" onClick={onClick} aria-label={label} title={label}>
      <Trash2 className="h-4 w-4" aria-hidden />
    </button>
  );
}
