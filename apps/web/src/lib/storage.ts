import { parsePdaDefinition, parseTmDefinition } from '@cw/core';
import type { MachineKind, PdaDefinition, TmDefinition } from '@cw/core';

export type AnyDefinition = PdaDefinition | TmDefinition;

export interface SavedMachine {
  id: string;
  kind: MachineKind;
  name: string;
  savedAt: string;
  definition: AnyDefinition;
}

const SAVED_KEY = 'cw.saved.v1';
const DRAFT_KEY = (kind: MachineKind) => `cw.draft.${kind.toLowerCase()}.v1`;

function read(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Parses a stored definition with the shared Zod schema; corrupt entries are skipped, not repaired. */
function parseDefinition(kind: MachineKind, value: unknown): AnyDefinition | null {
  const r = kind === 'PDA' ? parsePdaDefinition(value) : parseTmDefinition(value);
  return r.success ? r.data : null;
}

export function listSaved(): SavedMachine[] {
  const raw = read(SAVED_KEY);
  if (!Array.isArray(raw)) return [];
  const out: SavedMachine[] = [];
  for (const item of raw as unknown[]) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    if ((o.kind !== 'PDA' && o.kind !== 'TM') || typeof o.id !== 'string') continue;
    const definition = parseDefinition(o.kind, o.definition);
    if (!definition) continue;
    out.push({
      id: o.id,
      kind: o.kind,
      name: typeof o.name === 'string' ? o.name : definition.name,
      savedAt: typeof o.savedAt === 'string' ? o.savedAt : new Date(0).toISOString(),
      definition,
    });
  }
  return out;
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Saves a definition (replacing the entry with `id` when given). Returns the saved entry, or null if storage failed. */
export function saveMachine(definition: AnyDefinition, id?: string): SavedMachine | null {
  const all = listSaved();
  const entry: SavedMachine = {
    id: id ?? newId(),
    kind: definition.kind,
    name: definition.name || 'Untitled machine',
    savedAt: new Date().toISOString(),
    definition,
  };
  const next = all.some((m) => m.id === entry.id) ? all.map((m) => (m.id === entry.id ? entry : m)) : [entry, ...all];
  return write(SAVED_KEY, next) ? entry : null;
}

export function deleteSaved(id: string): void {
  write(SAVED_KEY, listSaved().filter((m) => m.id !== id));
}

export function getSaved(id: string): SavedMachine | undefined {
  return listSaved().find((m) => m.id === id);
}

export function loadDraft(kind: MachineKind): AnyDefinition | null {
  return parseDefinition(kind, read(DRAFT_KEY(kind)));
}

export function saveDraft(definition: AnyDefinition): void {
  write(DRAFT_KEY(definition.kind), definition);
}
