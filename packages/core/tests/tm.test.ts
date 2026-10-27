import { describe, expect, it } from 'vitest';
import {
  SparseTape,
  TM_ANBNCN,
  TM_ANBN,
  TM_BOTH_DIRECTIONS,
  TM_CONFLICTING,
  TM_INFINITE_LOOP,
  TM_INVALID_START,
  TM_MISSING_TRANSITION,
  TM_UNARY_INCREMENT,
  executeTm,
} from '../src';
import type { TmDefinition } from '../src';

const status = (def: TmDefinition, input: string, opts = {}) => executeTm(def, input, opts).status;

describe('TM a^n b^n c^n', () => {
  it.each(['abc', 'aabbcc', 'aaabbbccc', 'aaaabbbbcccc'])('accepts %s', (w) => {
    expect(status(TM_ANBNCN, w)).toBe('ACCEPTED');
  });

  it.each(['aabcc', 'aabbccc', 'abbc', 'ababcc', 'baaccc', '', 'ac', 'aabbc', 'abcabc', 'cba', 'abcc'])(
    'rejects %j',
    (w) => {
      expect(status(TM_ANBNCN, w)).toBe('REJECTED');
    },
  );

  it('rejects symbols outside the input alphabet before running', () => {
    const r = executeTm(TM_ANBNCN, 'abcd');
    expect(r.status).toBe('REJECTED');
    expect(r.haltReason).toBe('INPUT_ALPHABET');
    expect(r.rejectedByAlphabet).toBe(true);
  });

  it('marks symbols with X, Y, Z through genuine tape writes', () => {
    const r = executeTm(TM_ANBNCN, 'aabbcc');
    expect(r.status).toBe('ACCEPTED');
    expect(r.finalTapeContent).toBe('XXYYZZ');
    // Count only writes that change a cell (the machine also rewrites X/Y/Z while skipping over them).
    const marks = r.configurations.flatMap((c) => (c.applied && c.applied.read !== c.applied.write ? [`${c.applied.read}>${c.applied.write}`] : []));
    expect(marks.filter((m) => m === 'a>X')).toHaveLength(2);
    expect(marks.filter((m) => m === 'b>Y')).toHaveLength(2);
    expect(marks.filter((m) => m === 'c>Z')).toHaveLength(2);
    expect(marks).toHaveLength(6);
  });

  it('is genuinely quadratic in step count (not a counting shortcut)', () => {
    const s = (n: number) => executeTm(TM_ANBNCN, 'a'.repeat(n) + 'b'.repeat(n) + 'c'.repeat(n)).steps;
    expect(s(2)).toBeGreaterThan(s(1) * 2);
    expect(s(8)).toBeGreaterThan(s(4) * 3);
  });

  it('explains a mismatch through a missing transition', () => {
    const r = executeTm(TM_ANBNCN, 'aabcc');
    expect(r.haltReason).toBe('MISSING_TRANSITION');
    expect(r.missingTransition).toEqual({ state: 'seekB', symbol: 'Z' });
  });

  it('rejects leftover symbols through the explicit reject state', () => {
    const r = executeTm(TM_ANBNCN, 'aabbccc');
    expect(r.haltReason).toBe('REJECT_STATE');
    expect(r.finalConfiguration?.state).toBe('reject');
  });
});

describe('TM aⁿbⁿ explicit reject state', () => {
  it('halts in the visible reject state when a symbols outnumber b symbols', () => {
    const r = executeTm(TM_ANBN, 'aab');
    expect(r.status).toBe('REJECTED');
    expect(r.haltReason).toBe('REJECT_STATE');
    expect(r.finalConfiguration?.state).toBe('reject');
  });
});

describe('TM unary increment', () => {
  it.each([
    ['', '1'],
    ['1', '11'],
    ['111', '1111'],
  ])('maps %j to %j', (input, output) => {
    const r = executeTm(TM_UNARY_INCREMENT, input);
    expect(r.status).toBe('ACCEPTED');
    expect(r.finalTapeContent).toBe(output);
  });

  it('moves the head right then back to cell 0', () => {
    const r = executeTm(TM_UNARY_INCREMENT, '11');
    const heads = r.configurations.map((c) => c.head);
    expect(Math.max(...heads)).toBe(2);
    expect(Math.min(...heads)).toBe(-1);
    expect(r.finalConfiguration?.head).toBe(0);
  });
});

describe('Tape model', () => {
  it('extends to the left of cell 0 on a two-way infinite tape', () => {
    const r = executeTm(TM_BOTH_DIRECTIONS, '');
    expect(r.status).toBe('ACCEPTED');
    const heads = r.configurations.map((c) => c.head);
    expect(heads).toEqual([0, -1, -2, -1, -1]);
    expect(r.finalTapeContent).toBe('zyx');
    expect(r.finalConfiguration?.tape.origin).toBe(-2);
  });

  it('keeps the head on cell 0 in the left-bounded model', () => {
    const tape = new SparseTape('_', 'LEFT_BOUNDED');
    expect(tape.move(0, 'L')).toBe(0);
    expect(tape.move(3, 'L')).toBe(2);
    const infinite = new SparseTape('_');
    expect(infinite.move(0, 'L')).toBe(-1);
  });

  it('the left-bounded model changes how the same machine behaves', () => {
    const bounded: TmDefinition = { ...TM_BOTH_DIRECTIONS, tapeModel: 'LEFT_BOUNDED' };
    // q0 writes x on cell 0 and "moves left" (stays at 0); q1 then reads x, for which no transition exists.
    const r = executeTm(bounded, '');
    expect(r.status).toBe('REJECTED');
    expect(r.haltReason).toBe('MISSING_TRANSITION');
  });

  it('is sparse: writing blank removes the cell and wide tapes are clipped in snapshots', () => {
    const tape = new SparseTape('_');
    tape.write(1_000_000, 'x');
    tape.write(-1_000_000, 'y');
    const snap = tape.snapshot(0);
    expect(snap.cells.length).toBeLessThanOrEqual(400);
    expect(snap.clippedLeft && snap.clippedRight).toBe(true);
    tape.write(1_000_000, '_');
    expect(tape.read(1_000_000)).toBe('_');
  });
});

describe('Halting behaviour', () => {
  it('a missing transition is an implicit reject, not a loop or an inconclusive result', () => {
    const r = executeTm(TM_MISSING_TRANSITION, 'b');
    expect(r.status).toBe('REJECTED');
    expect(r.haltReason).toBe('MISSING_TRANSITION');
    expect(r.missingTransition).toEqual({ state: 'q0', symbol: 'b' });
    expect(r.steps).toBe(0);
  });

  it('accepts via the only defined transition', () => {
    expect(status(TM_MISSING_TRANSITION, 'a')).toBe('ACCEPTED');
  });

  it('a machine that never halts is INCONCLUSIVE at the step limit', () => {
    const r = executeTm(TM_INFINITE_LOOP, 'a', { maxSteps: 100 });
    expect(r.status).toBe('INCONCLUSIVE');
    expect(r.haltReason).toBe('STEP_LIMIT');
    expect(r.steps).toBe(100);
    expect(r.reason).toMatch(/cannot tell whether/);
  });

  it('a limit that is too small makes a valid word inconclusive, not rejected', () => {
    expect(status(TM_ANBNCN, 'aabbcc', { maxSteps: 5 })).toBe('INCONCLUSIVE');
  });

  it('entering an accept state on exactly the last permitted step still counts as a halt', () => {
    const full = executeTm(TM_UNARY_INCREMENT, '11');
    expect(status(TM_UNARY_INCREMENT, '11', { maxSteps: full.steps })).toBe('ACCEPTED');
    expect(status(TM_UNARY_INCREMENT, '11', { maxSteps: full.steps - 1 })).toBe('INCONCLUSIVE');
  });
});

describe('Trace', () => {
  it('records state, head, step number and applied transition for each configuration', () => {
    const r = executeTm(TM_UNARY_INCREMENT, '1');
    expect(r.configurations[0]).toMatchObject({ step: 0, state: 'scan', head: 0, applied: null, symbolUnderHead: '1' });
    expect(r.configurations[1]).toMatchObject({ step: 1, state: 'scan', head: 1, applied: { id: 't1', move: 'R' } });
    expect(r.configurations.map((c) => c.step)).toEqual([0, 1, 2, 3, 4]);
  });

  it('bounds the trace but always keeps the final configuration', () => {
    const r = executeTm(TM_INFINITE_LOOP, '', { maxSteps: 500, maxTraceSteps: 10 });
    expect(r.traceTruncated).toBe(true);
    expect(r.configurations.length).toBe(11);
    expect(r.configurations[10]?.step).toBe(500);
  });
});

describe('Invalid machines', () => {
  it('reports an unknown start state', () => {
    const r = executeTm(TM_INVALID_START, 'a');
    expect(r.status).toBe('INVALID_MACHINE');
    expect(r.issues.some((i) => i.code === 'START_STATE_UNKNOWN')).toBe(true);
  });

  it('reports conflicting transitions in a deterministic machine', () => {
    const r = executeTm(TM_CONFLICTING, 'a');
    expect(r.status).toBe('INVALID_MACHINE');
    expect(r.issues.some((i) => i.code === 'CONFLICTING_TRANSITIONS')).toBe(true);
  });
});
