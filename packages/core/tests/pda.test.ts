import { describe, expect, it } from 'vitest';
import {
  PDA_ANBN,
  PDA_CONFLICTING,
  PDA_EMPTY_STACK_ONLY,
  PDA_EPSILON_CHAIN,
  PDA_EPSILON_CYCLE,
  PDA_INVALID_START,
  PDA_PALINDROME,
  PDA_WCW_REVERSE,
  PDA_PARENTHESES,
  PDA_RUNAWAY,
  executePda,
} from '../src';
import type { PdaDefinition } from '../src';

const status = (def: PdaDefinition, input: string, opts = {}) => executePda(def, input, opts).status;

describe('PDA a^n b^n (final-state acceptance)', () => {
  it.each(['ab', 'aabb', 'aaabbb', 'aaaabbbb'])('accepts %s', (w) => {
    expect(status(PDA_ANBN, w)).toBe('ACCEPTED');
  });

  it.each(['aab', 'abb', 'abab', 'ba', '', 'a', 'b', 'aabbb', 'aaabb'])('rejects %j', (w) => {
    expect(status(PDA_ANBN, w)).toBe('REJECTED');
  });

  it('really runs stack transitions: pushes then pops one marker per symbol', () => {
    const r = executePda(PDA_ANBN, 'aabb');
    expect(r.status).toBe('ACCEPTED');
    expect(r.acceptedBy).toBe('FINAL_STATE');
    const path = r.acceptingPath.map((id) => r.nodes.find((n) => n.id === id)!);
    // ((q0,0,Z) -a-> (q0,1,ZA) -a-> (q0,2,ZAA) -b-> (q1,3,ZA) -b-> (q1,4,Z) -ε-> (q2,4,Z))
    expect(path.map((n) => n.configuration.state)).toEqual(['q0', 'q0', 'q0', 'q1', 'q1', 'q2']);
    expect(path.map((n) => n.configuration.position)).toEqual([0, 1, 2, 3, 4, 4]);
    expect(path.map((n) => n.configuration.stack.join(''))).toEqual(['Z', 'ZA', 'ZAA', 'ZA', 'Z', 'Z']);
    expect(path.map((n) => n.transitionId)).toEqual([null, 't1', 't2', 't3', 't4', 't5']);
    expect(r.steps).toBe(5);
  });

  it('rejects foreign symbols before running any transition', () => {
    const r = executePda(PDA_ANBN, 'aXb');
    expect(r.status).toBe('REJECTED');
    expect(r.rejectedByAlphabet).toBe(true);
    expect(r.nodes).toHaveLength(0);
    expect(r.reason).toMatch(/not in the input alphabet/);
  });

  it('reports an exhaustive rejection for a deterministic machine with one config per level', () => {
    const r = executePda(PDA_ANBN, 'aab', { stopOnAccept: false });
    expect(r.status).toBe('REJECTED');
    expect(r.stats.limitHit).toBeNull();
    expect(r.levels.every((lvl) => lvl.length <= 1)).toBe(true);
  });
});

describe('PDA w c wᴿ mirror language', () => {
  it.each(['c', 'aca', 'bcb', 'abcba', 'bacab', 'aabcbaa', 'aabacabaa'])('accepts %j', (w) => {
    expect(status(PDA_WCW_REVERSE, w)).toBe('ACCEPTED');
  });
  it.each(['acb', 'abca', 'abcab', 'ab', '', 'abbcba'])('rejects %j', (w) => {
    expect(status(PDA_WCW_REVERSE, w)).toBe('REJECTED');
  });
});

describe('PDA balanced parentheses (empty-stack acceptance)', () => {
  it.each(['()', '(())', '()()', '(()())', ''])('accepts %j', (w) => {
    const r = executePda(PDA_PARENTHESES, w);
    expect(r.status).toBe('ACCEPTED');
    expect(r.acceptedBy).toBe('EMPTY_STACK');
    expect(r.finalConfiguration?.stack).toEqual([]);
  });

  it.each(['(', ')', '(()', '())', ')(', '(()))'])('rejects %j', (w) => {
    expect(status(PDA_PARENTHESES, w)).toBe('REJECTED');
  });

  it('rejects other symbols', () => {
    expect(status(PDA_PARENTHESES, '(a)')).toBe('REJECTED');
  });
});

describe('Nondeterminism', () => {
  it.each(['', 'aa', 'abba', 'baab', 'abbbba', 'aabbaa'])('palindrome machine accepts %j', (w) => {
    expect(status(PDA_PALINDROME, w)).toBe('ACCEPTED');
  });

  it.each(['ab', 'aba', 'abab', 'abb'])('palindrome machine rejects %j', (w) => {
    expect(status(PDA_PALINDROME, w)).toBe('REJECTED');
  });

  it('explores several configurations simultaneously and does not follow only the first match', () => {
    const r = executePda(PDA_PALINDROME, 'abba', { stopOnAccept: false });
    expect(r.status).toBe('ACCEPTED');
    expect(r.stats.maxSimultaneous).toBeGreaterThan(1);
    expect(r.levels.some((lvl) => lvl.length > 1)).toBe(true);
    // The accepting computation guessed the middle after two symbols: an ε-move occurred between pushes and pops.
    const viaEpsilon = r.acceptingPath.map((id) => r.nodes.find((n) => n.id === id)!).filter((n) => n.transitionId && ['t7', 't8', 't9'].includes(n.transitionId));
    expect(viaEpsilon).toHaveLength(1);
  });

  it('a wrong middle guess is a dead branch but the word is still accepted by another', () => {
    const r = executePda(PDA_PALINDROME, 'aa', { stopOnAccept: false });
    expect(r.nodes.some((n) => n.configuration.status === 'DEAD_END')).toBe(true);
    expect(r.status).toBe('ACCEPTED');
  });
});

describe('Epsilon transitions', () => {
  it('accepts through a chain of ε-moves', () => {
    const r = executePda(PDA_EPSILON_CHAIN, 'a');
    expect(r.status).toBe('ACCEPTED');
    expect(r.acceptingPath).toHaveLength(4);
  });

  it('terminates on a finite ε-cycle by pruning duplicate configurations', () => {
    const r = executePda(PDA_EPSILON_CYCLE, 'a');
    expect(r.status).toBe('REJECTED');
    expect(r.stats.duplicatesPruned).toBeGreaterThan(0);
    expect(r.stats.limitHit).toBeNull();
  });
});

describe('Acceptance by empty stack with no input', () => {
  it('accepts "" and rejects "a"', () => {
    expect(status(PDA_EMPTY_STACK_ONLY, '')).toBe('ACCEPTED');
    expect(status(PDA_EMPTY_STACK_ONLY, 'a')).toBe('REJECTED');
  });
});

describe('Exploration budget', () => {
  it('returns INCONCLUSIVE, never REJECTED, when the configuration budget runs out', () => {
    const r = executePda(PDA_RUNAWAY, 'a', { maxConfigurations: 50 });
    expect(r.status).toBe('INCONCLUSIVE');
    expect(r.stats.limitHit).toBe('maxConfigurations');
    expect(r.stats.configurationsCreated).toBeLessThanOrEqual(50);
    expect(r.reason).toMatch(/not a rejection/);
  });

  it('returns INCONCLUSIVE when the stack limit prunes branches', () => {
    const r = executePda(PDA_RUNAWAY, '', { maxStackSize: 20 });
    expect(r.status).toBe('INCONCLUSIVE');
    expect(r.stats.limitHit).toBe('maxStackSize');
    expect(r.stats.prunedByStackLimit).toBeGreaterThan(0);
  });

  it('returns INCONCLUSIVE when the depth limit is reached', () => {
    const r = executePda(PDA_RUNAWAY, '', { maxDepth: 10 });
    expect(r.status).toBe('INCONCLUSIVE');
    expect(r.stats.limitHit).toBe('maxDepth');
  });

  it('a tiny budget makes a valid word inconclusive instead of rejected', () => {
    expect(status(PDA_ANBN, 'aaaabbbb', { maxConfigurations: 3 })).toBe('INCONCLUSIVE');
  });

  it('an accepting run found before the budget is exhausted is still ACCEPTED', () => {
    expect(status(PDA_ANBN, 'ab', { maxConfigurations: 10 })).toBe('ACCEPTED');
  });

  it('bounds the trace size but keeps the accepting path', () => {
    // A nondeterministic machine creates many dead branches besides the accepting path.
    const word = 'abbaabbaabba'.repeat(2);
    const full = executePda(PDA_PALINDROME, word, { maxTraceNodes: 5_000 });
    expect(full.traceTruncated).toBe(false);
    const r = executePda(PDA_PALINDROME, word, { maxTraceNodes: 5 });
    expect(r.status).toBe('ACCEPTED');
    expect(r.traceTruncated).toBe(true);
    expect(r.nodes.length).toBeLessThan(full.nodes.length);
    expect(r.acceptingPath.length).toBeGreaterThan(5);
    for (const id of r.acceptingPath) expect(r.nodes.some((n) => n.id === id)).toBe(true);
  });
});

describe('Invalid machines', () => {
  it('rejects a machine with an unknown start state as INVALID_MACHINE', () => {
    const r = executePda(PDA_INVALID_START, 'a');
    expect(r.status).toBe('INVALID_MACHINE');
    expect(r.issues.some((i) => i.code === 'START_STATE_UNKNOWN')).toBe(true);
  });

  it('rejects a DPDA with overlapping transitions', () => {
    const r = executePda(PDA_CONFLICTING, 'a');
    expect(r.status).toBe('INVALID_MACHINE');
    expect(r.issues.some((i) => i.code === 'PDA_NOT_DETERMINISTIC')).toBe(true);
  });

  it('does not modify the definition it is given', () => {
    const copy = JSON.stringify(PDA_ANBN);
    executePda(PDA_ANBN, 'aabb');
    expect(JSON.stringify(PDA_ANBN)).toBe(copy);
  });
});
