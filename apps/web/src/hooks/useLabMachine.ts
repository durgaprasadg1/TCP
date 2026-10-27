import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { MachineKind, PdaDefinition, TmDefinition } from '@cw/core';
import { useExamples } from './useExamples';
import { listSaved } from '../lib/storage';
import type { SavedMachine } from '../lib/storage';

export interface MachineOption {
  value: string; // "b:<builtin id>" or "s:<saved id>"
  label: string;
  group: 'Built-in' | 'Saved in this browser';
}

export interface LabMachine<D> {
  options: MachineOption[];
  selected: string;
  definition: D | null;
  description: string;
  language?: string;
  samples: { accepted: string[]; rejected: string[] };
  input: string;
  setInput: (s: string) => void;
  select: (value: string) => void;
  /** Increments when the page was opened with ?run=1 so the lab executes immediately. */
  autoRunKey: number;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Resolves the machine chosen with the URL (?m=b:pda-anbn&input=aabb) so examples can be linked to.
 * The definitions come from the API's /examples response or from the user's saved machines.
 */
export function useLabMachine(kind: 'PDA'): LabMachine<PdaDefinition>;
export function useLabMachine(kind: 'TM'): LabMachine<TmDefinition>;
export function useLabMachine(kind: MachineKind): LabMachine<PdaDefinition | TmDefinition> {
  const { machines, loading, error, reload } = useExamples();
  const [params, setParams] = useSearchParams();

  const saved = useMemo<SavedMachine[]>(() => listSaved().filter((s) => s.kind === kind), [kind]);
  const builtins = useMemo(() => machines.filter((m) => m.kind === kind), [machines, kind]);

  const options = useMemo<MachineOption[]>(
    () => [
      ...builtins.map((m) => ({ value: `b:${m.id}`, label: m.name, group: 'Built-in' as const })),
      ...saved.map((s) => ({ value: `s:${s.id}`, label: s.name, group: 'Saved in this browser' as const })),
    ],
    [builtins, saved],
  );

  const requested = params.get('m');
  const selected = requested && options.some((o) => o.value === requested) ? requested : (options[0]?.value ?? '');
  const input = params.get('input');

  const resolved = useMemo(() => {
    if (selected.startsWith('b:')) {
      const e = builtins.find((m) => m.id === selected.slice(2));
      return e ? { def: e.definition, description: e.description, language: e.language, accepted: e.sampleAccepted, rejected: e.sampleRejected, defaultInput: e.defaultInput } : null;
    }
    if (selected.startsWith('s:')) {
      const s = saved.find((m) => m.id === selected.slice(2));
      return s ? { def: s.definition, description: s.definition.description ?? '', language: undefined, accepted: [], rejected: [], defaultInput: '' } : null;
    }
    return null;
  }, [selected, builtins, saved]);

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === null) next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return {
    options,
    selected,
    definition: resolved?.def ?? null,
    description: resolved?.description ?? '',
    language: resolved?.language,
    samples: { accepted: resolved?.accepted ?? [], rejected: resolved?.rejected ?? [] },
    input: input ?? resolved?.defaultInput ?? '',
    setInput: (s) => update({ input: s, run: null }),
    select: (value) => update({ m: value, input: null, run: null }),
    autoRunKey: params.get('run') === '1' ? 1 : 0,
    loading,
    error,
    reload,
  };
}
