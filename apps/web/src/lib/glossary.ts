/** Short explanations for Theory of Computation terms, shown as tooltips. */
export const GLOSSARY: Record<string, { term: string; text: string }> = {
  pda: { term: 'Pushdown automaton (PDA)', text: 'A finite-state machine with a stack. The stack gives it unbounded but last-in-first-out memory; PDAs recognize exactly the context-free languages.' },
  tm: { term: 'Turing machine (TM)', text: 'A finite-state machine with a head that reads and writes an unbounded tape and moves left or right. It models general computation.' },
  configuration: { term: 'Configuration', text: 'A snapshot of a computation: for a PDA (state, input position, stack); for a TM (state, tape, head position).' },
  epsilon: { term: 'ε (epsilon)', text: 'The empty string. An ε input means the transition reads no input symbol; an ε stack-top means it neither looks at nor pops the stack.' },
  stackTop: { term: 'Stack top', text: 'The most recently pushed symbol. A PDA transition can only pop or inspect the top.' },
  nondeterminism: { term: 'Nondeterminism', text: 'Several transitions may apply to one configuration. The machine accepts if at least one branch accepts, so the simulator explores all branches.' },
  finalState: { term: 'Acceptance by final state', text: 'The PDA accepts when all input is consumed and it is in a final state, whatever the stack holds.' },
  emptyStack: { term: 'Acceptance by empty stack', text: 'The PDA accepts when all input is consumed and the stack is empty, whatever the state.' },
  blank: { term: 'Blank symbol', text: 'The symbol held by every tape cell that has never been written. It is part of the tape alphabet but not of the input alphabet.' },
  head: { term: 'Head', text: 'The read/write position on the tape. Each step reads the cell under it, writes a symbol and moves L, R or stays (S).' },
  inconclusive: { term: 'Inconclusive', text: 'The resource budget ran out before the machine halted or all branches were explored. This is not a rejection: a finite simulation cannot prove that a machine never halts.' },
  implicitReject: { term: 'Implicit reject', text: 'A Turing machine in a non-halting state with no transition for the symbol under its head halts and rejects.' },
  decider: { term: 'Decider', text: 'A Turing machine that halts on every input. A language recognized by a decider is decidable.' },
  twoWay: { term: 'Two-way infinite tape', text: 'The tape extends without bound to the left and right of the input. Cells outside the input start blank.' },
  language: { term: 'Language', text: 'A set of strings over an alphabet. A machine recognizes the language of strings it accepts.' },
  dpda: { term: 'Deterministic', text: 'At most one transition applies to any configuration, so the computation is a single path.' },
};
