import type { ExecutionStatus, MachineKind, TestCase } from '../shared-types';

let counter = 0;

function make(
  machineKind: MachineKind,
  machineId: string,
  category: string,
  input: string,
  expected: ExecutionStatus,
  description: string,
  options?: TestCase['options'],
): TestCase {
  counter += 1;
  const tc: TestCase = {
    id: `${machineId}#${String(counter).padStart(3, '0')}`,
    machineId,
    machineKind,
    category,
    description,
    input,
    expected,
  };
  if (options) tc.options = options;
  return tc;
}

const show = (s: string) => (s === '' ? 'empty input' : `"${s}"`);

function many(
  kind: MachineKind,
  machineId: string,
  category: string,
  inputs: string[],
  expected: ExecutionStatus,
  describe: (input: string) => string,
  options?: TestCase['options'],
): TestCase[] {
  return inputs.map((i) => make(kind, machineId, category, i, expected, describe(i), options));
}

const pda = (id: string, cat: string, inputs: string[], exp: ExecutionStatus, d: (i: string) => string) =>
  many('PDA', id, cat, inputs, exp, d);
const tm = (
  id: string,
  cat: string,
  inputs: string[],
  exp: ExecutionStatus,
  d: (i: string) => string,
  options?: TestCase['options'],
) => many('TM', id, cat, inputs, exp, d, options);

export const BUILTIN_TEST_CASES: readonly TestCase[] = [
  // ---------------- PDA 1: a^n b^n (final-state acceptance, deterministic) ----------------
  ...pda('pda-anbn', 'Spec examples: accepted', ['ab', 'aabb', 'aaabbb', 'aaaabbbb'], 'ACCEPTED', (i) => `${show(i)} is aⁿbⁿ with n ≥ 1`),
  ...pda('pda-anbn', 'Unequal symbol counts', ['aab', 'abb'], 'REJECTED', (i) => `${show(i)} has unequal numbers of a and b`),
  ...pda('pda-anbn', 'Incorrect symbol ordering', ['abab', 'ba', 'baab'], 'REJECTED', (i) => `${show(i)} violates the a-before-b ordering`),
  ...pda('pda-anbn', 'Empty input', [''], 'REJECTED', () => 'n ≥ 1 forbids the empty string'),
  ...pda('pda-anbn', 'Missing and extra symbols', ['a', 'b', 'aabbb', 'aaabb'], 'REJECTED', (i) => `${show(i)} has a missing or extra symbol`),
  ...pda('pda-anbn', 'Invalid alphabet symbols', ['abc', 'aXb'], 'REJECTED', (i) => `${show(i)} contains a symbol outside {a, b}`),
  ...pda('pda-anbn', 'Acceptance by final state', ['aabb'], 'ACCEPTED', () => 'accepts by reaching final state q2 with input consumed'),

  // ---------------- PDA 2: balanced parentheses (empty-stack acceptance) ----------------
  ...pda('pda-parentheses', 'Spec examples: accepted', ['()', '(())', '()()', '(()())'], 'ACCEPTED', (i) => `${show(i)} is balanced`),
  ...pda('pda-parentheses', 'Spec examples: rejected', ['(', ')', '(()', '())'], 'REJECTED', (i) => `${show(i)} is not balanced`),
  ...pda('pda-parentheses', 'Incorrect symbol ordering', [')('], 'REJECTED', () => 'closing before opening'),
  ...pda('pda-parentheses', 'Invalid alphabet symbols', ['(a)'], 'REJECTED', () => 'contains a symbol outside {(, )}'),
  ...pda('pda-parentheses', 'Acceptance by empty stack', ['', '(())'], 'ACCEPTED', (i) => `${show(i)} is accepted because the stack ends empty`),

  // ---------------- PDA 3: nondeterministic palindromes ----------------
  ...pda('pda-palindrome', 'Nondeterministic branches', ['', 'aa', 'abba', 'baab', 'abbbba'], 'ACCEPTED', (i) => `${show(i)} = w·wᴿ: one guess of the middle accepts`),
  ...pda('pda-palindrome', 'Nondeterministic branches', ['ab', 'aba', 'abab'], 'REJECTED', (i) => `${show(i)} is not an even palindrome: every guess of the middle fails`),

  // ---------------- PDA attempt at L2 (recognizes a^n b^n c^m, not a^n b^n c^n) ----------------
  ...pda('pda-anbn-cstar', 'Single-stack limitation', ['abc', 'aabbcc', 'aabbc', 'aabbccc'], 'ACCEPTED', (i) => `${show(i)}: accepted because the c's are only checked to be a block (so this PDA does not recognize aⁿbⁿcⁿ)`),
  ...pda('pda-anbn-cstar', 'Single-stack limitation', ['aabbbcc', 'aaabbc', 'abcabc', ''], 'REJECTED', (i) => `${show(i)} fails the aⁿbⁿ part or the ordering`),

  // ---------------- PDA edge cases ----------------
  make('PDA', 'pda-epsilon-chain', 'Epsilon transitions', 'a', 'ACCEPTED', 'reaches the final state only through two ε-moves'),
  make('PDA', 'pda-epsilon-chain', 'Epsilon transitions', '', 'REJECTED', 'ε-moves alone never reach the final state'),
  make('PDA', 'pda-epsilon-cycle', 'Epsilon transitions', 'a', 'REJECTED', 'finite ε-cycle: duplicate configurations are pruned and exploration terminates'),
  make('PDA', 'pda-empty-stack-only', 'Acceptance by empty stack', '', 'ACCEPTED', 'an ε-move pops the bottom marker, leaving the stack empty'),
  make('PDA', 'pda-empty-stack-only', 'Acceptance by empty stack', 'a', 'REJECTED', 'input is not consumed by any transition'),
  make('PDA', 'pda-runaway', 'PDA exploration-budget exhaustion', 'a', 'INCONCLUSIVE', 'unbounded stack growth: the configuration budget runs out', { maxConfigurations: 50 }),
  make('PDA', 'pda-runaway', 'PDA exploration-budget exhaustion', '', 'INCONCLUSIVE', 'unbounded stack growth: the stack-size limit stops exploration', { maxStackSize: 20 }),
  make('PDA', 'pda-runaway', 'PDA exploration-budget exhaustion', '', 'INCONCLUSIVE', 'unbounded stack growth: the depth limit stops exploration', { maxDepth: 10 }),
  make('PDA', 'pda-anbn', 'PDA exploration-budget exhaustion', 'aaaabbbb', 'INCONCLUSIVE', 'a valid word cannot be decided with a budget of 3 configurations', { maxConfigurations: 3 }),
  make('PDA', 'pda-invalid-start', 'Invalid machine definitions', 'a', 'INVALID_MACHINE', 'start state is not declared'),
  make('PDA', 'pda-conflicting', 'Invalid machine definitions', 'a', 'INVALID_MACHINE', 'declared deterministic but has overlapping transitions'),

  // ---------------- TM 1: a^n b^n c^n ----------------
  ...tm('tm-anbncn', 'Spec examples: accepted', ['abc', 'aabbcc', 'aaabbbccc', 'aaaabbbbcccc'], 'ACCEPTED', (i) => `${show(i)} is aⁿbⁿcⁿ with n ≥ 1`),
  ...tm('tm-anbncn', 'Unequal symbol counts', ['aabcc', 'aabbccc', 'abbc'], 'REJECTED', (i) => `${show(i)} has unequal counts`),
  ...tm('tm-anbncn', 'Incorrect symbol ordering', ['ababcc', 'baaccc', 'abcabc', 'cba'], 'REJECTED', (i) => `${show(i)} violates a-then-b-then-c ordering`),
  ...tm('tm-anbncn', 'Empty input', [''], 'REJECTED', () => 'n ≥ 1 forbids the empty string'),
  ...tm('tm-anbncn', 'Missing and extra symbols', ['ac', 'aabbc', 'aabbccc', 'abcc'], 'REJECTED', (i) => `${show(i)} has a missing or extra symbol`),
  ...tm('tm-anbncn', 'Invalid alphabet symbols', ['abcd', 'abx'], 'REJECTED', (i) => `${show(i)} contains a symbol outside {a, b, c}`),
  ...tm('tm-anbncn', 'Execution-limit exhaustion', ['aabbcc'], 'INCONCLUSIVE', () => 'a valid word cannot be decided within 5 steps', { maxSteps: 5 }),

  // ---------------- TM for L1: a^n b^n ----------------
  ...tm('tm-anbn', 'Spec examples: accepted', ['ab', 'aabb', 'aaabbb', 'aaaabbbb'], 'ACCEPTED', (i) => `${show(i)} is aⁿbⁿ with n ≥ 1 (TM version)`),
  ...tm('tm-anbn', 'Unequal symbol counts', ['aab', 'abb'], 'REJECTED', (i) => `${show(i)} has unequal numbers of a and b (TM version)`),
  ...tm('tm-anbn', 'Incorrect symbol ordering', ['abab', 'ba'], 'REJECTED', (i) => `${show(i)} violates the a-before-b ordering (TM version)`),
  ...tm('tm-anbn', 'Empty input', [''], 'REJECTED', () => 'n ≥ 1 forbids the empty string (TM version)'),

  // ---------------- TM 2: unary increment ----------------
  ...tm('tm-unary-increment', 'Tape movement in both directions', ['', '1', '111'], 'ACCEPTED', (i) => `${show(i)}: head goes right to write a 1, then back left`),
  ...tm('tm-unary-increment', 'Invalid alphabet symbols', ['11a'], 'REJECTED', () => 'contains a symbol outside {1}'),

  // ---------------- TM edge cases ----------------
  make('TM', 'tm-missing-transition', 'Missing TM transitions', 'a', 'ACCEPTED', 'the only defined transition (q0, a) leads to the accept state'),
  make('TM', 'tm-missing-transition', 'Missing TM transitions', 'b', 'REJECTED', '(q0, b) is undefined: implicit reject, not a limit or loop'),
  make('TM', 'tm-missing-transition', 'Missing TM transitions', '', 'REJECTED', '(q0, blank) is undefined: implicit reject'),
  make('TM', 'tm-infinite-loop', 'Execution-limit exhaustion', 'a', 'INCONCLUSIVE', 'the machine never halts; the step limit stops the simulation', { maxSteps: 100 }),
  make('TM', 'tm-both-directions', 'Tape movement in both directions', '', 'ACCEPTED', 'writes on cells 0, -1, -2 then moves back right'),
  make('TM', 'tm-invalid-start', 'Invalid machine definitions', 'a', 'INVALID_MACHINE', 'start state is not declared'),
  make('TM', 'tm-conflicting', 'Invalid machine definitions', 'a', 'INVALID_MACHINE', 'two different transitions for (q0, a)'),
];

export const TEST_CATEGORIES: readonly string[] = [...new Set(BUILTIN_TEST_CASES.map((t) => t.category))];
