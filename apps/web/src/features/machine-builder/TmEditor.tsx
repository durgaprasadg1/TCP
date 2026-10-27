import { Plus } from 'lucide-react';
import type { TmDefinition, TmTransition } from '@cw/core';
import { Card, Term } from '../../components/ui';
import { nextTransitionId } from './definitions';
import { AlphabetField, DeleteRowButton, StateSelect, StateSetPicker, StatesEditor, SymbolInput } from './editorParts';

interface Props {
  def: TmDefinition;
  onChange: (d: TmDefinition) => void;
}

export function TmEditor({ def, onChange }: Props) {
  const set = (patch: Partial<TmDefinition>) => onChange({ ...def, ...patch });
  const setT = (index: number, patch: Partial<TmTransition>) => set({ transitions: def.transitions.map((t, i) => (i === index ? { ...t, ...patch } : t)) });
  const addTransition = () => {
    const first = def.states[0] ?? '';
    set({ transitions: [...def.transitions, { id: nextTransitionId(def.transitions), from: def.startState || first, read: def.blank, to: first, write: def.blank, move: 'R' }] });
  };

  return (
    <div className="space-y-4">
      <Card title="Definition">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="tm-name">
              Name
            </label>
            <input id="tm-name" className="input !font-sans" value={def.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="tm-desc">
              Description
            </label>
            <input id="tm-desc" className="input !font-sans" value={def.description ?? ''} onChange={(e) => set({ description: e.target.value })} />
          </div>
          <StatesEditor states={def.states} onChange={(states) => set({ states })} />
          <div className="space-y-3">
            <div>
              <div className="label">Initial state</div>
              <StateSelect value={def.startState} states={def.states} onChange={(startState) => set({ startState })} label="Initial state" />
            </div>
            <StateSetPicker legend="Accepting halt states" states={def.states} selected={def.acceptStates} onChange={(acceptStates) => set({ acceptStates })} />
            <StateSetPicker legend="Rejecting halt states" states={def.states} selected={def.rejectStates} onChange={(rejectStates) => set({ rejectStates })} />
          </div>
          <AlphabetField id="tm-input-alpha" label="Input alphabet" value={def.inputAlphabet} onChange={(inputAlphabet) => set({ inputAlphabet })} hint="Must not contain the blank symbol." />
          <AlphabetField id="tm-tape-alpha" label="Tape alphabet" value={def.tapeAlphabet} onChange={(tapeAlphabet) => set({ tapeAlphabet })} hint="Include every input symbol, the blank and any marker symbols." />
          <div>
            <div className="label">
              <Term k="blank">Blank symbol</Term>
            </div>
            <SymbolInput value={def.blank} onChange={(blank) => set({ blank })} label="Blank symbol" placeholder="_" />
          </div>
          <div>
            <label className="label" htmlFor="tm-tape-model">
              Tape model
            </label>
            <select id="tm-tape-model" className="input" value={def.tapeModel ?? 'TWO_WAY_INFINITE'} onChange={(e) => set({ tapeModel: e.target.value === 'LEFT_BOUNDED' ? 'LEFT_BOUNDED' : 'TWO_WAY_INFINITE' })}>
              <option value="TWO_WAY_INFINITE">Two-way infinite (default)</option>
              <option value="LEFT_BOUNDED">Left-bounded (moving left from cell 0 stays on cell 0)</option>
            </select>
          </div>
        </div>
      </Card>

      <Card
        title="Transitions"
        actions={
          <button className="btn btn-primary" onClick={addTransition}>
            <Plus className="h-4 w-4" aria-hidden /> Add transition
          </button>
        }
      >
        <p className="mb-2 text-xs text-slate-400">
          δ(state, read) = (next state, write, move). Deterministic: at most one rule per (state, read). A missing rule makes the machine halt and reject (<Term k="implicitReject">implicit reject</Term>).
        </p>
        <datalist id="tm-symbols">
          {def.tapeAlphabet.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        {def.transitions.length === 0 ? (
          <p className="rounded-md border border-dashed border-ink-500 p-4 text-center text-sm text-slate-400">No transitions yet. Add one to start.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse">
              <thead>
                <tr>
                  {['id', 'Current state', 'Read', 'Next state', 'Write', 'Move', ''].map((h) => (
                    <th key={h} className="th">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {def.transitions.map((t, i) => (
                  <tr key={i} className="border-t border-ink-700">
                    <td className="td text-slate-500">{t.id}</td>
                    <td className="p-1">
                      <StateSelect value={t.from} states={def.states} onChange={(from) => setT(i, { from })} label={`${t.id} current state`} />
                    </td>
                    <td className="p-1">
                      <SymbolInput value={t.read} onChange={(read) => setT(i, { read })} label={`${t.id} read symbol`} list="tm-symbols" placeholder="sym" />
                    </td>
                    <td className="p-1">
                      <StateSelect value={t.to} states={def.states} onChange={(to) => setT(i, { to })} label={`${t.id} next state`} />
                    </td>
                    <td className="p-1">
                      <SymbolInput value={t.write} onChange={(write) => setT(i, { write })} label={`${t.id} write symbol`} list="tm-symbols" placeholder="sym" />
                    </td>
                    <td className="p-1">
                      <select className="input !w-24 !px-1.5" value={t.move} onChange={(e) => setT(i, { move: e.target.value as TmTransition['move'] })} aria-label={`${t.id} head direction`}>
                        <option value="L">← Left</option>
                        <option value="R">→ Right</option>
                        <option value="S">• Stay</option>
                      </select>
                    </td>
                    <td className="p-1">
                      <DeleteRowButton label={`Delete transition ${t.id}`} onClick={() => set({ transitions: def.transitions.filter((_, j) => j !== i) })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
