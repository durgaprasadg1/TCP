import { parsePdaDefinition, parseTmDefinition } from '@cw/core';
import type { MachineKind, PdaDefinition, TmDefinition, ValidationIssue } from '@cw/core';
import type { AnyDefinition } from '../../lib/storage';

export function blankPda(): PdaDefinition {
  return {
    kind: 'PDA',
    name: 'My PDA',
    description: '',
    states: ['q0', 'q1'],
    inputAlphabet: ['a', 'b'],
    stackAlphabet: ['Z', 'A'],
    startState: 'q0',
    initialStackSymbol: 'Z',
    finalStates: ['q1'],
    acceptanceMode: 'FINAL_STATE',
    deterministic: false,
    transitions: [],
  };
}

export function blankTm(): TmDefinition {
  return {
    kind: 'TM',
    name: 'My Turing machine',
    description: '',
    states: ['q0', 'accept', 'reject'],
    inputAlphabet: ['a', 'b'],
    tapeAlphabet: ['a', 'b', '_'],
    blank: '_',
    startState: 'q0',
    acceptStates: ['accept'],
    rejectStates: ['reject'],
    tapeModel: 'TWO_WAY_INFINITE',
    transitions: [],
  };
}

export function blankFor(kind: MachineKind): AnyDefinition {
  return kind === 'PDA' ? blankPda() : blankTm();
}

/** "a b, c" -> ["a", "b", "c"]. Duplicates and multi-character tokens are kept so validation can report them. */
export function parseSymbolList(text: string): string[] {
  return text.split(/[\s,]+/).filter((s) => s !== '');
}

export function nextTransitionId(transitions: { id: string }[]): string {
  let max = 0;
  for (const t of transitions) {
    const m = /^t(\d+)$/.exec(t.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `t${max + 1}`;
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export type ImportResult = { ok: true; definition: AnyDefinition } | { ok: false; issues: ValidationIssue[] };

/** Parses imported JSON text with the shared Zod schemas. Nothing is repaired or defaulted silently beyond the schema. */
export function importDefinition(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, issues: [{ severity: 'error', code: 'INVALID_JSON', message: `Not valid JSON: ${e instanceof Error ? e.message : 'parse error'}` }] };
  }
  const kind = typeof raw === 'object' && raw !== null ? (raw as { kind?: unknown }).kind : undefined;
  if (kind !== 'PDA' && kind !== 'TM') {
    return { ok: false, issues: [{ severity: 'error', code: 'UNKNOWN_KIND', message: 'The JSON must contain "kind": "PDA" or "kind": "TM".', path: 'kind' }] };
  }
  const r = kind === 'PDA' ? parsePdaDefinition(raw) : parseTmDefinition(raw);
  return r.success ? { ok: true, definition: r.data } : { ok: false, issues: r.issues };
}

export function downloadJson(definition: AnyDefinition): void {
  const blob = new Blob([JSON.stringify(definition, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const slug = (definition.name || 'machine').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'machine';
  a.href = url;
  a.download = `${slug}.${definition.kind.toLowerCase()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
