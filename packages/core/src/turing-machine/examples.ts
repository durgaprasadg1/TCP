import type { Direction, TmDefinition, TmTransition } from './types';

type Rule = [from: string, read: string, to: string, write: string, move: Direction];

function rules(list: Rule[]): TmTransition[] {
  return list.map(([from, read, to, write, move], i) => ({ id: `t${i + 1}`, from, read, to, write, move }));
}

/**
 * L2 = { a^n b^n c^n | n >= 1 } by repeated marking.
 *
 * Phase 1 (v_a, v_b, v_c): a pure scan checks the shape a+ b+ c+ with TM transitions only. Anything else
 *   (empty input, foreign symbols, wrong order) has no transition and is rejected as an implicit reject.
 * Phase 2 (rewind, seekA, seekB, seekC): each round marks the leftmost unmarked a as X, the first unmarked b
 *   as Y and the first unmarked c as Z, then rewinds to the blank left of the tape (the two-way infinite
 *   tape has blanks to the left of cell 0, which is how the machine finds the left end).
 * Phase 3 (verify): when seekA meets a Y there is no unmarked a left; the rest of the tape must hold only
 *   Y's and Z's. A leftover b or c rejects; reaching the blank accepts.
 *
 * Tape alphabet: a b c X Y Z _ (blank = "_").
 */
export const TM_ANBNCN: TmDefinition = {
  kind: 'TM',
  name: 'a^n b^n c^n (n ≥ 1)',
  description:
    'Marks one a (X), one b (Y) and one c (Z) per round, rewinding to the left end each time. Accepts when everything is marked and nothing is left over.',
  states: ['start', 'v_a', 'v_b', 'v_c', 'rewind', 'seekA', 'seekB', 'seekC', 'verify', 'accept', 'reject'],
  inputAlphabet: ['a', 'b', 'c'],
  tapeAlphabet: ['a', 'b', 'c', 'X', 'Y', 'Z', '_'],
  blank: '_',
  startState: 'start',
  acceptStates: ['accept'],
  rejectStates: ['reject'],
  tapeModel: 'TWO_WAY_INFINITE',
  transitions: rules([
    // Phase 1: validate the shape a+ b+ c+
    ['start', 'a', 'v_a', 'a', 'R'],
    ['start', '_', 'reject', '_', 'S'], // empty input: n >= 1 is required
    ['v_a', 'a', 'v_a', 'a', 'R'],
    ['v_a', 'b', 'v_b', 'b', 'R'],
    ['v_b', 'b', 'v_b', 'b', 'R'],
    ['v_b', 'c', 'v_c', 'c', 'R'],
    ['v_c', 'c', 'v_c', 'c', 'R'],
    ['v_c', '_', 'rewind', '_', 'L'],
    // Phase 2: go back to the left end (blank), then step onto cell 0
    ['rewind', 'a', 'rewind', 'a', 'L'],
    ['rewind', 'b', 'rewind', 'b', 'L'],
    ['rewind', 'c', 'rewind', 'c', 'L'],
    ['rewind', 'X', 'rewind', 'X', 'L'],
    ['rewind', 'Y', 'rewind', 'Y', 'L'],
    ['rewind', 'Z', 'rewind', 'Z', 'L'],
    ['rewind', '_', 'seekA', '_', 'R'],
    // find the leftmost unmarked a
    ['seekA', 'X', 'seekA', 'X', 'R'],
    ['seekA', 'a', 'seekB', 'X', 'R'], // mark a
    ['seekA', 'Y', 'verify', 'Y', 'R'], // no unmarked a left
    // find the first unmarked b
    ['seekB', 'a', 'seekB', 'a', 'R'],
    ['seekB', 'Y', 'seekB', 'Y', 'R'],
    ['seekB', 'b', 'seekC', 'Y', 'R'], // mark b; no transition on c, Z or blank = more a's than b's
    // find the first unmarked c
    ['seekC', 'b', 'seekC', 'b', 'R'],
    ['seekC', 'Z', 'seekC', 'Z', 'R'],
    ['seekC', 'c', 'rewind', 'Z', 'L'], // mark c; no transition on blank = more a's than c's
    // Phase 3: nothing but Y and Z may remain
    ['verify', 'Y', 'verify', 'Y', 'R'],
    ['verify', 'Z', 'verify', 'Z', 'R'],
    ['verify', '_', 'accept', '_', 'S'],
    ['verify', 'b', 'reject', 'b', 'S'], // leftover b
    ['verify', 'c', 'reject', 'c', 'S'], // leftover c
  ]),
};

/**
 * L1 = { a^n b^n | n >= 1 } on a Turing machine, by marking: each round turns the leftmost unmarked a into X and
 * the first unmarked b into Y. Used by the comparison laboratory to show that a TM also recognizes L1.
 * Ordering violations and count mismatches end in a missing transition (implicit reject) or the reject state.
 */
export const TM_ANBN: TmDefinition = {
  kind: 'TM',
  name: 'a^n b^n (n ≥ 1)',
  description: 'Marks one a (X) and one b (Y) per round. When no unmarked a remains, only Y\'s may be left on the tape.',
  states: ['q0', 'qB', 'qBack', 'verify', 'accept', 'reject'],
  inputAlphabet: ['a', 'b'],
  tapeAlphabet: ['a', 'b', 'X', 'Y', '_'],
  blank: '_',
  startState: 'q0',
  acceptStates: ['accept'],
  rejectStates: ['reject'],
  tapeModel: 'TWO_WAY_INFINITE',
  transitions: rules([
    ['q0', 'a', 'qB', 'X', 'R'], // mark the leftmost unmarked a
    ['q0', 'Y', 'verify', 'Y', 'R'], // no unmarked a left
    ['q0', '_', 'reject', '_', 'S'], // empty input
    ['qB', 'a', 'qB', 'a', 'R'],
    ['qB', 'Y', 'qB', 'Y', 'R'],
    ['qB', 'b', 'qBack', 'Y', 'L'], // mark the first unmarked b
    ['qB', '_', 'reject', '_', 'S'], // more a's than b's: halt in the visible reject state
    ['qBack', 'a', 'qBack', 'a', 'L'],
    ['qBack', 'Y', 'qBack', 'Y', 'L'],
    ['qBack', 'X', 'q0', 'X', 'R'], // back at the last marked a: step right to the next unmarked a
    ['verify', 'Y', 'verify', 'Y', 'R'],
    ['verify', '_', 'accept', '_', 'S'],
    ['verify', 'b', 'reject', 'b', 'S'], // leftover b
    ['verify', 'a', 'reject', 'a', 'S'], // a after b: wrong order
  ]),
};

/**
 * Unary increment: replaces 1^n by 1^(n+1). Shows writing and head movement in both directions
 * independently of language recognition. It accepts every input over {1}; the result is the tape content.
 */
export const TM_UNARY_INCREMENT: TmDefinition = {
  kind: 'TM',
  name: 'Unary increment',
  description: 'Scans right to the first blank, writes a 1 there, returns left to the start and accepts. Tape content after halting is 1^(n+1).',
  states: ['scan', 'back', 'accept', 'reject'],
  inputAlphabet: ['1'],
  tapeAlphabet: ['1', '_'],
  blank: '_',
  startState: 'scan',
  acceptStates: ['accept'],
  rejectStates: ['reject'],
  tapeModel: 'TWO_WAY_INFINITE',
  transitions: rules([
    ['scan', '1', 'scan', '1', 'R'],
    ['scan', '_', 'back', '1', 'L'], // write the extra 1, turn around
    ['back', '1', 'back', '1', 'L'],
    ['back', '_', 'accept', '_', 'R'], // blank left of the start: step back onto cell 0
  ]),
};

// ---------------------------------------------------------------------------------------------
// Fixtures used by the test runner to exercise edge cases.
// ---------------------------------------------------------------------------------------------

/** Accepts "a" but has no transition for any other symbol: a missing transition is an implicit reject. */
export const TM_MISSING_TRANSITION: TmDefinition = {
  kind: 'TM',
  name: 'Missing transition',
  description: 'Only defines (q0, a); every other symbol halts the machine as an implicit reject.',
  states: ['q0', 'qa', 'qr'],
  inputAlphabet: ['a', 'b'],
  tapeAlphabet: ['a', 'b', '_'],
  blank: '_',
  startState: 'q0',
  acceptStates: ['qa'],
  rejectStates: ['qr'],
  transitions: rules([['q0', 'a', 'qa', 'a', 'R']]),
};

/** Walks right forever over blanks: never halts, so a step limit yields INCONCLUSIVE. */
export const TM_INFINITE_LOOP: TmDefinition = {
  kind: 'TM',
  name: 'Runs forever',
  description: 'Moves right over blanks forever; never reaches a halting state.',
  states: ['q0', 'qa', 'qr'],
  inputAlphabet: ['a'],
  tapeAlphabet: ['a', '_'],
  blank: '_',
  startState: 'q0',
  acceptStates: ['qa'],
  rejectStates: ['qr'],
  transitions: rules([
    ['q0', 'a', 'q0', 'a', 'R'],
    ['q0', '_', 'q0', '_', 'R'],
  ]),
};

/**
 * Writes x at cell 0, y at cell -1, z at cell -2, then turns right and checks it can read y again.
 * Proves the tape is two-way infinite and that the head can move in both directions.
 */
export const TM_BOTH_DIRECTIONS: TmDefinition = {
  kind: 'TM',
  name: 'Both directions',
  description: 'Writes x, y, z on cells 0, -1, -2 (left of the input) and then moves right again.',
  states: ['q0', 'q1', 'q2', 'q3', 'qa', 'qr'],
  inputAlphabet: ['a'],
  tapeAlphabet: ['a', 'x', 'y', 'z', '_'],
  blank: '_',
  startState: 'q0',
  acceptStates: ['qa'],
  rejectStates: ['qr'],
  transitions: rules([
    ['q0', '_', 'q1', 'x', 'L'],
    ['q1', '_', 'q2', 'y', 'L'],
    ['q2', '_', 'q3', 'z', 'R'],
    ['q3', 'y', 'qa', 'y', 'S'],
  ]),
};

/** Two different rules for (q0, a): a deterministic TM must not allow this. */
export const TM_CONFLICTING: TmDefinition = {
  kind: 'TM',
  name: 'Conflicting transitions',
  description: 'Defines two different actions for (q0, a).',
  states: ['q0', 'qa', 'qr'],
  inputAlphabet: ['a'],
  tapeAlphabet: ['a', '_'],
  blank: '_',
  startState: 'q0',
  acceptStates: ['qa'],
  rejectStates: ['qr'],
  transitions: rules([
    ['q0', 'a', 'qa', 'a', 'R'],
    ['q0', 'a', 'qr', 'a', 'R'],
  ]),
};

/** Start state is not among the declared states. */
export const TM_INVALID_START: TmDefinition = {
  kind: 'TM',
  name: 'Invalid start state',
  description: 'Start state q9 does not exist.',
  states: ['q0', 'qa'],
  inputAlphabet: ['a'],
  tapeAlphabet: ['a', '_'],
  blank: '_',
  startState: 'q9',
  acceptStates: ['qa'],
  rejectStates: [],
  transitions: [],
};
