import { Plus } from 'lucide-react';
import type { PdaDefinition, PdaTransition } from '@cw/core';
import { Card, Term } from '../../components/ui';
import { nextTransitionId } from './definitions';
import { AlphabetField, DeleteRowButton, StateSelect, StateSetPicker, StatesEditor, SymbolInput } from './editorParts';

interface Props {
  def: PdaDefinition;
  onChange: (d: PdaDefinition) => void;
}

export function PdaEditor({ def, onChange }: Props) {
  const set = (patch: Partial<PdaDefinition>) => onChange({ ...def, ...patch });
  const setT = (index: number, patch: Partial<PdaTransition>) => set({ transitions: def.transitions.map((t, i) => (i === index ? { ...t, ...patch } : t)) });
  const addTransition = () => {
    const first = def.states[0] ?? '';
    set({ transitions: [...def.transitions, { id: nextTransitionId(def.transitions), from: def.startState || first, input: '', stackTop: '', to: first, push: '' }] });
  };

  return (
    <div className="space-y-4">
      <Card title="Definition">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="pda-name">
              Name
            </label>
            <input id="pda-name" className="input !font-sans" value={def.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="pda-desc">
              Description
            </label>
            <input id="pda-desc" className="input !font-sans" value={def.description ?? ''} onChange={(e) => set({ description: e.target.value })} />
          </div>
          <StatesEditor states={def.states} onChange={(states) => set({ states })} />
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="pda-start">
                Initial state
              </label>
              <StateSelect value={def.startState} states={def.states} onChange={(startState) => set({ startState })} label="Initial state" />
            </div>
            <StateSetPicker legend="Final states" states={def.states} selected={def.finalStates} onChange={(finalStates) => set({ finalStates })} />
          </div>
          <AlphabetField id="pda-input-alpha" label="Input alphabet" value={def.inputAlphabet} onChange={(inputAlphabet) => set({ inputAlphabet })} hint="Single characters separated by spaces or commas." />
          <AlphabetField id="pda-stack-alpha" label="Stack alphabet" value={def.stackAlphabet} onChange={(stackAlphabet) => set({ stackAlphabet })} hint="Single characters separated by spaces or commas." />
          <div>
            <label className="label" htmlFor="pda-z">
              Initial stack symbol
            </label>
            <SymbolInput value={def.initialStackSymbol} onChange={(initialStackSymbol) => set({ initialStackSymbol })} label="Initial stack symbol" placeholder="Z" />
          </div>
          <div className="space-y-2">
            <fieldset>
              <legend className="label">Acceptance</legend>
              <label className="mr-4 inline-flex items-center gap-1.5 text-sm">
                <input type="radio" name="accept-mode" checked={def.acceptanceMode === 'FINAL_STATE'} onChange={() => set({ acceptanceMode: 'FINAL_STATE' })} />
                <Term k="finalState">final state</Term>
              </label>
              <label className="inline-flex items-center gap-1.5 text-sm">
                <input type="radio" name="accept-mode" checked={def.acceptanceMode === 'EMPTY_STACK'} onChange={() => set({ acceptanceMode: 'EMPTY_STACK' })} />
                <Term k="emptyStack">empty stack</Term>
              </label>
            </fieldset>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={def.deterministic === true} onChange={(e) => set({ deterministic: e.target.checked })} />
              Require <Term k="dpda">deterministic</Term> (flag overlapping transitions as errors)
            </label>
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
          Read the input symbol (or <Term k="epsilon">ε</Term>), require and pop the stack top (or ε to ignore the stack), go to the next state and push the replacement string (top symbol first; empty pushes nothing). To replace top X by Y keep the rest with push “Y”; to keep X and add Y on top push “YX”.
        </p>
        <datalist id="pda-input-symbols">
          {def.inputAlphabet.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <datalist id="pda-stack-symbols">
          {def.stackAlphabet.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        {def.transitions.length === 0 ? (
          <p className="rounded-md border border-dashed border-ink-500 p-4 text-center text-sm text-slate-400">No transitions yet. Add one to start.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr>
                  {['id', 'Current state', 'Input', 'Stack top', 'Next state', 'Push (top first)', ''].map((h) => (
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
                      <SymbolInput value={t.input} onChange={(input) => setT(i, { input })} label={`${t.id} input symbol`} list="pda-input-symbols" />
                    </td>
                    <td className="p-1">
                      <SymbolInput value={t.stackTop} onChange={(stackTop) => setT(i, { stackTop })} label={`${t.id} stack top`} list="pda-stack-symbols" />
                    </td>
                    <td className="p-1">
                      <StateSelect value={t.to} states={def.states} onChange={(to) => setT(i, { to })} label={`${t.id} next state`} />
                    </td>
                    <td className="p-1">
                      <SymbolInput value={t.push} onChange={(push) => setT(i, { push })} label={`${t.id} pushed string`} wide />
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
