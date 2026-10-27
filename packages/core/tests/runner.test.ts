import { describe, expect, it } from 'vitest';
import { BUILTIN_TEST_CASES, PDA_ANBN, TEST_CATEGORIES, runTestCase, runTestSuite } from '../src';
import type { TestCase } from '../src';

describe('built-in test suite', () => {
  it('passes every case by really executing the engines', () => {
    const { results, summary } = runTestSuite(BUILTIN_TEST_CASES);
    const bad = results.filter((r) => !r.passed).map((r) => `${r.testId} ${r.input} expected ${r.expected} got ${r.actual}`);
    expect(bad).toEqual([]);
    expect(summary.total).toBe(BUILTIN_TEST_CASES.length);
    expect(summary.failed).toBe(0);
    expect(summary.inconclusive).toBe(0);
  });

  it('covers every edge case category required by the specification', () => {
    const required = [
      'Empty input',
      'Invalid alphabet symbols',
      'Incorrect symbol ordering',
      'Unequal symbol counts',
      'Missing and extra symbols',
      'Epsilon transitions',
      'Nondeterministic branches',
      'Acceptance by final state',
      'Acceptance by empty stack',
      'Missing TM transitions',
      'Execution-limit exhaustion',
      'PDA exploration-budget exhaustion',
      'Invalid machine definitions',
      'Tape movement in both directions',
    ];
    for (const c of required) expect(TEST_CATEGORIES).toContain(c);
  });

  it('has unique test ids', () => {
    expect(new Set(BUILTIN_TEST_CASES.map((t) => t.id)).size).toBe(BUILTIN_TEST_CASES.length);
  });
});

describe('test runner is not hardcoded', () => {
  const base: TestCase = {
    id: 'x',
    machineId: 'pda-anbn',
    machineKind: 'PDA',
    category: 'custom',
    description: 'd',
    input: 'aabb',
    expected: 'ACCEPTED',
  };

  it('reports FAIL when the expectation is wrong', () => {
    const r = runTestCase({ ...base, expected: 'REJECTED' });
    expect(r.outcome).toBe('FAIL');
    expect(r.passed).toBe(false);
    expect(r.actual).toBe('ACCEPTED');
  });

  it('reports INCONCLUSIVE when a budget prevents checking the expectation', () => {
    const r = runTestCase({ ...base, options: { maxConfigurations: 2 } });
    expect(r.outcome).toBe('INCONCLUSIVE');
    expect(r.passed).toBe(false);
  });

  it('reports PASS with step counts when the expectation is right', () => {
    const r = runTestCase(base);
    expect(r.outcome).toBe('PASS');
    expect(r.steps).toBe(5);
  });

  it('can run against a machine supplied by the caller', () => {
    const r = runTestCase({ ...base, machineId: 'mine' }, (id) => (id === 'mine' ? PDA_ANBN : undefined));
    expect(r.outcome).toBe('PASS');
  });

  it('fails cleanly for an unknown machine or a kind mismatch', () => {
    expect(runTestCase({ ...base, machineId: 'missing' }).outcome).toBe('FAIL');
    expect(runTestCase({ ...base, machineKind: 'TM' }).outcome).toBe('FAIL');
  });
});
