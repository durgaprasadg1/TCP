import type { AcceptanceMode, PdaDefinition, PdaTransition } from './types';

type Rule = [from: string, input: string, stackTop: string, to: string, push: string];

function rules(list: Rule[]): PdaTransition[] {
  return list.map(([from, input, stackTop, to, push], i) => ({ id: `t${i + 1}`, from, input, stackTop, to, push }));
}

/**
 * L1 = { a^n b^n | n >= 1 }, acceptance by final state.
 * Z is the bottom marker, A counts the a's.
 */
export const PDA_ANBN: PdaDefinition = {
  kind: 'PDA',
  name: 'a^n b^n (n ≥ 1)',
  description: 'Pushes one A per a, pops one A per b, then checks that only the bottom marker Z remains. Accepts by final state.',
  states: ['q0', 'q1', 'q2'],
  inputAlphabet: ['a', 'b'],
  stackAlphabet: ['Z', 'A'],
  startState: 'q0',
  initialStackSymbol: 'Z',
  finalStates: ['q2'],
  acceptanceMode: 'FINAL_STATE',
  deterministic: true,
  transitions: rules([
    ['q0', 'a', 'Z', 'q0', 'AZ'], // first a: replace Z by A on top of Z
    ['q0', 'a', 'A', 'q0', 'AA'], // further a's: push another A
    ['q0', 'b', 'A', 'q1', ''], // first b: pop an A, switch to matching phase
    ['q1', 'b', 'A', 'q1', ''], // further b's: pop an A
    ['q1', 'ε', 'Z', 'q2', 'Z'], // only Z left: all a's were matched
  ]),
};

/**
 * A genuine attempt at L2 = { a^n b^n c^n } with ONE stack: it checks a^n b^n by popping and then has nothing
 * left to compare the c's with, so it can only check that the c's form a block. It recognizes
 * { a^n b^n c^m | n, m >= 1 }, which is a different (context-free) language and wrongly accepts "aabbc".
 * No other single-stack design can succeed: L2 is not context-free (pumping lemma for context-free languages).
 */
export const PDA_ANBN_CSTAR: PdaDefinition = {
  kind: 'PDA',
  name: 'Failed attempt at aⁿbⁿcⁿ (recognizes aⁿbⁿcᵐ)',
  description:
    'Counts the a\'s on the stack and pops them on the b\'s. By the time the c\'s arrive the count is gone, so the c\'s can only be checked to form a block: it wrongly accepts aabbc.',
  states: ['q0', 'q1', 'q2', 'q3'],
  inputAlphabet: ['a', 'b', 'c'],
  stackAlphabet: ['Z', 'A'],
  startState: 'q0',
  initialStackSymbol: 'Z',
  finalStates: ['q3'],
  acceptanceMode: 'FINAL_STATE',
  // Not declared deterministic: (q2, c, Z) overlaps the ε-move (q2, ε, Z).
  transitions: rules([
    ['q0', 'a', 'Z', 'q0', 'AZ'],
    ['q0', 'a', 'A', 'q0', 'AA'],
    ['q0', 'b', 'A', 'q1', ''],
    ['q1', 'b', 'A', 'q1', ''],
    ['q1', 'c', 'Z', 'q2', 'Z'], // a's and b's matched; the stack holds no information about the count any more
    ['q2', 'c', 'Z', 'q2', 'Z'],
    ['q2', 'ε', 'Z', 'q3', 'Z'],
  ]),
};

/**
 * Balanced parentheses, acceptance by empty stack. The empty string is balanced (n = 0) and is accepted.
 */
export const PDA_PARENTHESES: PdaDefinition = {
  kind: 'PDA',
  name: 'Balanced parentheses',
  description:
    'Pushes P for every "(" and pops P for every ")". On an exhausted stack of P\'s the bottom marker Z is popped by an ε-move, leaving the stack empty. Accepts by empty stack; the empty string is balanced.',
  states: ['q0', 'q1'],
  inputAlphabet: ['(', ')'],
  stackAlphabet: ['Z', 'P'],
  startState: 'q0',
  initialStackSymbol: 'Z',
  finalStates: [],
  acceptanceMode: 'EMPTY_STACK',
  // Not declared deterministic: (q0, ε, Z) overlaps (q0, "(", Z), although the ε-move only helps at end of input.
  transitions: rules([
    ['q0', '(', 'Z', 'q0', 'PZ'],
    ['q0', '(', 'P', 'q0', 'PP'],
    ['q0', ')', 'P', 'q0', ''],
    ['q0', 'ε', 'Z', 'q1', ''], // pop the bottom marker: stack becomes empty
  ]),
};

/**
 * Even-length palindromes w w^R over {a, b}. Genuinely nondeterministic: the ε-move that
 * "guesses the middle" competes with the push moves in q0.
 */
export const PDA_PALINDROME: PdaDefinition = {
  kind: 'PDA',
  name: 'Even palindromes w·wᴿ',
  description:
    'Nondeterministic: in q0 it pushes the first half and, via ε-transitions, guesses where the middle is. In q1 it pops and matches the second half. Accepts by final state.',
  states: ['q0', 'q1', 'q2'],
  inputAlphabet: ['a', 'b'],
  stackAlphabet: ['Z', 'A', 'B'],
  startState: 'q0',
  initialStackSymbol: 'Z',
  finalStates: ['q2'],
  acceptanceMode: 'FINAL_STATE',
  transitions: rules([
    ['q0', 'a', 'Z', 'q0', 'AZ'],
    ['q0', 'b', 'Z', 'q0', 'BZ'],
    ['q0', 'a', 'A', 'q0', 'AA'],
    ['q0', 'a', 'B', 'q0', 'AB'],
    ['q0', 'b', 'A', 'q0', 'BA'],
    ['q0', 'b', 'B', 'q0', 'BB'],
    ['q0', 'ε', 'Z', 'q1', 'Z'], // guess: middle reached
    ['q0', 'ε', 'A', 'q1', 'A'],
    ['q0', 'ε', 'B', 'q1', 'B'],
    ['q1', 'a', 'A', 'q1', ''],
    ['q1', 'b', 'B', 'q1', ''],
    ['q1', 'ε', 'Z', 'q2', 'Z'],
  ]),
};


/** L = { w c wᴿ | w ∈ {a,b}* }. Push the prefix onto the stack, switch at the unique c,
 * then match the suffix by popping the same symbols in reverse order. */
export const PDA_WCW_REVERSE: PdaDefinition = {
  kind: 'PDA',
  name: 'w c wᴿ — separator c (built-in)',
  description: 'Reads and pushes w before the separator c, then reads wᴿ while popping matching symbols. The middle c is the turning point.',
  states: ['push', 'match', 'accept'],
  inputAlphabet: ['a', 'b', 'c'],
  stackAlphabet: ['Z', 'A', 'B'],
  startState: 'push',
  initialStackSymbol: 'Z',
  finalStates: ['accept'],
  acceptanceMode: 'FINAL_STATE',
  deterministic: true,
  transitions: rules([
    ['push', 'a', 'Z', 'push', 'AZ'],
    ['push', 'a', 'A', 'push', 'AA'],
    ['push', 'a', 'B', 'push', 'AB'],
    ['push', 'b', 'Z', 'push', 'BZ'],
    ['push', 'b', 'A', 'push', 'BA'],
    ['push', 'b', 'B', 'push', 'BB'],
    ['push', 'c', 'Z', 'match', 'Z'],
    ['push', 'c', 'A', 'match', 'A'],
    ['push', 'c', 'B', 'match', 'B'],
    ['match', 'a', 'A', 'match', ''],
    ['match', 'b', 'B', 'match', ''],
    ['match', 'ε', 'Z', 'accept', 'Z'],
  ]),
};

// ---------------------------------------------------------------------------------------------
// Fixtures used by the test runner to exercise edge cases. They are not shown as lab examples.
// ---------------------------------------------------------------------------------------------

function fixture(
  name: string,
  description: string,
  partial: Pick<PdaDefinition, 'states' | 'inputAlphabet' | 'stackAlphabet' | 'startState' | 'finalStates' | 'transitions'> &
    Partial<Pick<PdaDefinition, 'initialStackSymbol' | 'acceptanceMode' | 'deterministic'>>,
): PdaDefinition {
  return {
    kind: 'PDA',
    name,
    description,
    initialStackSymbol: 'Z',
    acceptanceMode: 'FINAL_STATE' as AcceptanceMode,
    ...partial,
  };
}

/** Accepts exactly "a" but only after two ε-moves: q0 -ε-> q1 -ε-> q2 -a-> q3. */
export const PDA_EPSILON_CHAIN = fixture('ε-transition chain', 'Accepts "a" only through ε-moves that read no input.', {
  states: ['q0', 'q1', 'q2', 'q3'],
  inputAlphabet: ['a'],
  stackAlphabet: ['Z'],
  startState: 'q0',
  finalStates: ['q3'],
  transitions: rules([
    ['q0', 'ε', 'ε', 'q1', ''],
    ['q1', 'ε', 'ε', 'q2', ''],
    ['q2', 'a', 'ε', 'q3', ''],
  ]),
});

/** ε-cycle that never grows the stack: the reachable configuration set is finite, so the answer is REJECTED. */
export const PDA_EPSILON_CYCLE = fixture('ε-cycle (finite)', 'q0 and q1 bounce between each other with ε-moves; accepts nothing.', {
  states: ['q0', 'q1', 'q2'],
  inputAlphabet: ['a'],
  stackAlphabet: ['Z'],
  startState: 'q0',
  finalStates: ['q2'],
  transitions: rules([
    ['q0', 'ε', 'ε', 'q1', ''],
    ['q1', 'ε', 'ε', 'q0', ''],
  ]),
});

/** Pushes forever on ε. Infinitely many configurations, so exploration cannot finish. */
export const PDA_RUNAWAY = fixture('Runaway stack', 'Pushes an A on every ε-move forever; exploration can never finish.', {
  states: ['q0', 'q1'],
  inputAlphabet: ['a'],
  stackAlphabet: ['Z', 'A'],
  startState: 'q0',
  finalStates: ['q1'],
  transitions: rules([['q0', 'ε', 'ε', 'q0', 'A']]),
});

/** Marked deterministic but q0 has overlapping transitions: invalid. */
export const PDA_CONFLICTING: PdaDefinition = fixture('Conflicting DPDA', 'Declared deterministic but two transitions overlap.', {
  states: ['q0', 'q1'],
  inputAlphabet: ['a'],
  stackAlphabet: ['Z'],
  startState: 'q0',
  finalStates: ['q1'],
  deterministic: true,
  transitions: rules([
    ['q0', 'a', 'Z', 'q1', 'Z'],
    ['q0', 'ε', 'Z', 'q1', 'Z'],
  ]),
});

/** Start state is not among the declared states. */
export const PDA_INVALID_START: PdaDefinition = fixture('Invalid start state', 'Start state q9 does not exist.', {
  states: ['q0'],
  inputAlphabet: ['a'],
  stackAlphabet: ['Z'],
  startState: 'q9',
  finalStates: ['q0'],
  transitions: [],
});

/** Accepts the empty input by emptying the stack, to test acceptance by empty stack with no input. */
export const PDA_EMPTY_STACK_ONLY = fixture('Empty-stack acceptance', 'Pops Z with an ε-move: accepts "" and rejects anything else.', {
  states: ['q0', 'q1'],
  inputAlphabet: ['a'],
  stackAlphabet: ['Z'],
  startState: 'q0',
  finalStates: [],
  acceptanceMode: 'EMPTY_STACK',
  transitions: rules([['q0', 'ε', 'Z', 'q1', '']]),
});
