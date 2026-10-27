import { describe, expect, it } from 'vitest';
import {
  PDA_ANBN,
  PDA_PALINDROME,
  TM_ANBNCN,
  TM_UNARY_INCREMENT,
  parsePdaDefinition,
  parseTmDefinition,
  validatePda,
  validateTm,
} from '../src';
import type { PdaDefinition, TmDefinition } from '../src';

const codes = (r: { issues: { code: string }[] }) => r.issues.map((i) => i.code);
const clonePda = (): PdaDefinition => JSON.parse(JSON.stringify(PDA_ANBN)) as PdaDefinition;
const cloneTm = (): TmDefinition => JSON.parse(JSON.stringify(TM_UNARY_INCREMENT)) as TmDefinition;

describe('validatePda', () => {
  it('accepts the built-in machines', () => {
    expect(validatePda(PDA_ANBN).valid).toBe(true);
    expect(validatePda(PDA_PALINDROME).valid).toBe(true);
  });

  it('flags nondeterminism as information for a normal PDA', () => {
    const r = validatePda(PDA_PALINDROME);
    expect(r.issues.find((i) => i.code === 'NONDETERMINISTIC')?.severity).toBe('info');
  });

  it('detects an unknown start state, final state and initial stack symbol', () => {
    const d = clonePda();
    d.startState = 'nope';
    d.finalStates = ['ghost'];
    d.initialStackSymbol = 'Q';
    const c = codes(validatePda(d));
    expect(c).toContain('START_STATE_UNKNOWN');
    expect(c).toContain('FINAL_STATE_UNKNOWN');
    expect(c).toContain('INITIAL_STACK_SYMBOL_UNKNOWN');
  });

  it('detects unknown states and symbols in transitions', () => {
    const d = clonePda();
    d.transitions.push({ id: 'x', from: 'zz', input: 'c', stackTop: 'Q', to: 'yy', push: 'W' });
    const c = codes(validatePda(d));
    expect(c).toContain('TRANSITION_STATE_UNKNOWN');
    expect(c).toContain('TRANSITION_INPUT_UNKNOWN');
    expect(c).toContain('TRANSITION_STACK_UNKNOWN');
    expect(c).toContain('TRANSITION_PUSH_UNKNOWN');
  });

  it('detects duplicate states, symbols, transitions and ids', () => {
    const d = clonePda();
    d.states.push('q0');
    d.inputAlphabet.push('a');
    d.transitions.push({ ...(d.transitions[0] as PdaDefinition['transitions'][number]), id: 't1' });
    const c = codes(validatePda(d));
    expect(c).toContain('DUPLICATE_STATE');
    expect(c).toContain('DUPLICATE_SYMBOL');
    expect(c).toContain('DUPLICATE_TRANSITION');
    expect(c).toContain('DUPLICATE_TRANSITION_ID');
  });

  it('rejects multi-character symbols and ε in alphabets', () => {
    const d = clonePda();
    d.inputAlphabet.push('ab', 'ε');
    const c = codes(validatePda(d));
    expect(c).toContain('SYMBOL_NOT_SINGLE_CHAR');
    expect(c).toContain('EPSILON_IN_ALPHABET');
  });

  it('enforces determinism only when the machine claims to be deterministic', () => {
    const d = clonePda();
    d.transitions.push({ id: 'dup', from: 'q0', input: 'a', stackTop: 'A', to: 'q1', push: '' });
    expect(codes(validatePda(d))).toContain('PDA_NOT_DETERMINISTIC');
    d.deterministic = false;
    const r = validatePda(d);
    expect(r.valid).toBe(true);
    expect(codes(r)).toContain('NONDETERMINISTIC');
  });

  it('warns when final-state acceptance has no final states', () => {
    const d = clonePda();
    d.finalStates = [];
    const r = validatePda(d);
    expect(r.valid).toBe(true);
    expect(codes(r)).toContain('NO_FINAL_STATES');
  });
});

describe('validateTm', () => {
  it('accepts the built-in machines', () => {
    expect(validateTm(TM_UNARY_INCREMENT).valid).toBe(true);
    expect(validateTm(TM_ANBNCN).valid).toBe(true);
  });

  it('detects state and symbol reference errors', () => {
    const d = cloneTm();
    d.startState = 'nope';
    d.acceptStates.push('ghost');
    d.transitions.push({ id: 'x', from: 'zz', read: 'q', to: 'yy', write: 'w', move: 'R' });
    const c = codes(validateTm(d));
    expect(c).toContain('START_STATE_UNKNOWN');
    expect(c).toContain('ACCEPT_STATE_UNKNOWN');
    expect(c).toContain('TRANSITION_STATE_UNKNOWN');
    expect(c).toContain('TRANSITION_READ_UNKNOWN');
    expect(c).toContain('TRANSITION_WRITE_UNKNOWN');
  });

  it('detects conflicting and duplicate transitions', () => {
    const d = cloneTm();
    d.transitions.push({ id: 'c', from: 'scan', read: '1', to: 'back', write: '1', move: 'L' });
    d.transitions.push({ id: 'd', from: 'scan', read: '1', to: 'scan', write: '1', move: 'R' });
    const c = codes(validateTm(d));
    expect(c).toContain('CONFLICTING_TRANSITIONS');
    expect(c).toContain('DUPLICATE_TRANSITION');
  });

  it('checks blank and alphabet consistency', () => {
    const d = cloneTm();
    d.blank = '#';
    d.inputAlphabet.push('_');
    const c = codes(validateTm(d));
    expect(c).toContain('BLANK_NOT_IN_TAPE_ALPHABET');
  });

  it('rejects a bad head direction and overlapping accept/reject states', () => {
    const d = cloneTm();
    d.transitions[0] = { ...(d.transitions[0] as TmDefinition['transitions'][number]), move: 'X' as 'L' };
    d.rejectStates.push('accept');
    const c = codes(validateTm(d));
    expect(c).toContain('TRANSITION_MOVE_INVALID');
    expect(c).toContain('ACCEPT_REJECT_OVERLAP');
  });

  it('informs about incomplete tables (implicit reject)', () => {
    expect(codes(validateTm(TM_ANBNCN))).toContain('INCOMPLETE_TABLE');
  });

  it('warns about transitions leaving halting states', () => {
    const d = cloneTm();
    d.transitions.push({ id: 'h', from: 'accept', read: '1', to: 'scan', write: '1', move: 'R' });
    expect(codes(validateTm(d))).toContain('TRANSITION_FROM_HALTING_STATE');
  });
});

describe('Zod definition schemas', () => {
  it('parse and fill in transition ids', () => {
    const raw = JSON.parse(JSON.stringify(PDA_ANBN)) as Record<string, unknown>;
    (raw.transitions as Record<string, unknown>[]).forEach((t) => delete t.id);
    const r = parsePdaDefinition(raw);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.transitions.map((t) => t.id)).toEqual(['t1', 't2', 't3', 't4', 't5']);
  });

  it('report malformed definitions with a readable path', () => {
    const r = parsePdaDefinition({ states: 'q0' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.issues.some((i) => i.path === 'states')).toBe(true);
  });

  it('are strict about unknown keys', () => {
    const r = parseTmDefinition({ ...TM_UNARY_INCREMENT, script: 'alert(1)' });
    expect(r.success).toBe(false);
  });

  it('accept a valid TM', () => {
    expect(parseTmDefinition(TM_ANBNCN).success).toBe(true);
  });
});
