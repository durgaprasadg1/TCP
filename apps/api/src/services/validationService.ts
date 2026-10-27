import { parsePdaDefinition, parseTmDefinition, validatePda, validateTm } from '@cw/core';
import type { MachineKind, ValidationIssue } from '@cw/core';

export interface ValidationReport {
  kind: MachineKind;
  valid: boolean;
  issues: ValidationIssue[];
  summary: { states: number; transitions: number } | null;
}

/**
 * Two layers: structural parsing (Zod) then semantic validation. A malformed machine is reported
 * as a normal "invalid" answer so the editor can show every problem; nothing is repaired.
 */
export function validateMachine(kind: MachineKind, machine: unknown): ValidationReport {
  if (kind === 'PDA') {
    const parsed = parsePdaDefinition(machine);
    if (!parsed.success) return { kind, valid: false, issues: parsed.issues, summary: null };
    const r = validatePda(parsed.data);
    return { kind, valid: r.valid, issues: r.issues, summary: { states: parsed.data.states.length, transitions: parsed.data.transitions.length } };
  }
  const parsed = parseTmDefinition(machine);
  if (!parsed.success) return { kind, valid: false, issues: parsed.issues, summary: null };
  const r = validateTm(parsed.data);
  return { kind, valid: r.valid, issues: r.issues, summary: { states: parsed.data.states.length, transitions: parsed.data.transitions.length } };
}
