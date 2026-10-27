import type {
  ExecutionStatus,
  MachineEntry,
  MachineKind,
  PdaDefinition,
  PdaExecutionOptions,
  PdaExecutionResult,
  TestCase,
  TestResult,
  TestSummary,
  TmDefinition,
  TmExecutionOptions,
  TmExecutionResult,
  ValidationIssue,
} from '@cw/core';

/** Base URL of the Express API, configured with the VITE_API_BASE_URL environment variable. */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string; details?: unknown };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(
      `Cannot reach the API at ${API_BASE_URL}. Start it with "npm run dev:api" and check VITE_API_BASE_URL.`,
      0,
      'NETWORK',
    );
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const env = (body ?? {}) as ErrorEnvelope;
    const details = env.error?.details;
    let message = env.error?.message ?? `The API answered with HTTP ${res.status}.`;
    if (Array.isArray(details)) {
      const parts = details
        .map((d) => (typeof d === 'object' && d !== null && 'message' in d ? `${String((d as { path?: string }).path ?? '')}: ${String((d as { message: unknown }).message)}` : null))
        .filter((s): s is string => s !== null);
      if (parts.length > 0) message += ` (${parts.slice(0, 3).join('; ')})`;
    }
    throw new ApiError(message, res.status, env.error?.code ?? 'HTTP_ERROR', details);
  }
  return body as T;
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) });

export interface ExamplesResponse {
  machines: MachineEntry[];
  testCategories: string[];
  limits: {
    pda: { maxConfigurations: number; maxStackSize: number; maxDepth: number; maxTraceNodes: number };
    tm: { maxSteps: number; maxTraceSteps: number };
    pdaDefaults: Required<PdaExecutionOptions>;
    tmDefaults: Required<TmExecutionOptions>;
  };
}

export type PdaResponse = { kind: 'PDA'; machineName: string } & PdaExecutionResult;
export type TmResponse = { kind: 'TM'; machineName: string } & TmExecutionResult;

export interface ValidationReport {
  kind: MachineKind;
  valid: boolean;
  issues: ValidationIssue[];
  summary: { states: number; transitions: number } | null;
}

export interface TestRunResponse {
  results: TestResult[];
  summary: TestSummary;
}

export interface CustomTestCase {
  input: string;
  expected: ExecutionStatus;
  description?: string;
}

export const api = {
  health: () => request<{ status: string; time: string }>('/health'),
  examples: () => request<ExamplesResponse>('/examples'),
  validate: (kind: MachineKind, machine: PdaDefinition | TmDefinition) => post<ValidationReport>('/machines/validate', { kind, machine }),
  executePda: (machine: PdaDefinition, input: string, options: PdaExecutionOptions) =>
    post<PdaResponse>('/pda/execute', { machine, input, options }),
  executeTm: (machine: TmDefinition, input: string, options: TmExecutionOptions) =>
    post<TmResponse>('/tm/execute', { machine, input, options }),
  runTests: (body: { testIds?: string[]; categories?: string[] }) => post<TestRunResponse>('/tests/run', body),
  runCustomTests: (
    kind: MachineKind,
    machine: PdaDefinition | TmDefinition,
    cases: CustomTestCase[],
    options?: { maxSteps?: number; maxConfigurations?: number; maxStackSize?: number; maxDepth?: number },
  ) => post<TestRunResponse>('/tests/run', { custom: { kind, machine, cases, ...(options ? { options } : {}) } }),
  testCases: () => request<{ cases: TestCase[] }>('/tests/cases'),
};

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Unexpected error.';
}
