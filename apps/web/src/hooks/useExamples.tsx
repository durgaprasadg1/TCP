import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { MachineEntry, PdaEntry, TmEntry } from '@cw/core';
import { api, errorMessage } from '../lib/api';
import type { ExamplesResponse } from '../lib/api';

interface ExamplesState {
  data: ExamplesResponse | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  machines: MachineEntry[];
  pdas: PdaEntry[];
  tms: TmEntry[];
  get: (id: string) => MachineEntry | undefined;
}

const Ctx = createContext<ExamplesState | null>(null);

/** Loads the built-in machines from the Express API once and shares them with every page. */
export function ExamplesProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ExamplesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .examples()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const value = useMemo<ExamplesState>(() => {
    const machines = data?.machines ?? [];
    return {
      data,
      loading,
      error,
      reload,
      machines,
      pdas: machines.filter((m): m is PdaEntry => m.kind === 'PDA'),
      tms: machines.filter((m): m is TmEntry => m.kind === 'TM'),
      get: (id) => machines.find((m) => m.id === id),
    };
  }, [data, loading, error, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useExamples(): ExamplesState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useExamples must be used inside <ExamplesProvider>');
  return v;
}
