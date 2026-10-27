import { executePda } from '../pda/engine';
import type { PdaDefinition } from '../pda/types';
import { executeTm } from '../turing-machine/engine';
import type { TmDefinition } from '../turing-machine/types';
import { getMachine } from '../registry';
import type { ExecutionStatus, TestCase, TestOutcome, TestResult, TestSummary } from '../shared-types';

export interface TestSuiteResult {
  results: TestResult[];
  summary: TestSummary;
}

export type MachineResolver = (machineId: string) => PdaDefinition | TmDefinition | undefined;

const registryResolver: MachineResolver = (id) => getMachine(id)?.definition;

function classify(expected: ExecutionStatus, actual: ExecutionStatus): TestOutcome {
  if (expected === actual) return 'PASS';
  if (actual === 'INCONCLUSIVE') return 'INCONCLUSIVE';
  return 'FAIL';
}

/**
 * Runs one test case by really executing the machine and comparing the engine's verdict with the
 * expectation. Nothing here knows or guesses the answer: `expected` comes from the test case and
 * `actual` comes only from the engines.
 */
export function runTestCase(tc: TestCase, resolve: MachineResolver = registryResolver): TestResult {
  const machine = resolve(tc.machineId);
  const base = {
    testId: tc.id,
    machineId: tc.machineId,
    machineKind: tc.machineKind,
    category: tc.category,
    description: tc.description,
    input: tc.input,
    expected: tc.expected,
  };
  if (!machine) {
    return {
      ...base,
      actual: 'INVALID_MACHINE',
      outcome: tc.expected === 'INVALID_MACHINE' ? 'PASS' : 'FAIL',
      passed: tc.expected === 'INVALID_MACHINE',
      steps: null,
      explanation: `Machine '${tc.machineId}' was not found.`,
    };
  }

  let actual: ExecutionStatus;
  let steps: number | null;
  let reason: string;
  if (machine.kind === 'PDA' && tc.machineKind === 'PDA') {
    const r = executePda(machine, tc.input, {
      maxConfigurations: tc.options?.maxConfigurations,
      maxStackSize: tc.options?.maxStackSize,
      maxDepth: tc.options?.maxDepth,
    });
    actual = r.status;
    steps = r.status === 'INVALID_MACHINE' ? null : r.steps;
    reason = r.reason;
  } else if (machine.kind === 'TM' && tc.machineKind === 'TM') {
    const r = executeTm(machine, tc.input, { maxSteps: tc.options?.maxSteps });
    actual = r.status;
    steps = r.status === 'INVALID_MACHINE' ? null : r.steps;
    reason = r.reason;
  } else {
    return {
      ...base,
      actual: 'INVALID_MACHINE',
      outcome: 'FAIL',
      passed: false,
      steps: null,
      explanation: `Machine '${tc.machineId}' is a ${machine.kind} but the test case targets a ${tc.machineKind}.`,
    };
  }

  const outcome = classify(tc.expected, actual);
  const verdict =
    outcome === 'PASS'
      ? `Expected ${tc.expected}, got ${actual}.`
      : outcome === 'INCONCLUSIVE'
        ? `Expected ${tc.expected} but the run was INCONCLUSIVE (budget exhausted), so the expectation could not be checked.`
        : `Expected ${tc.expected} but got ${actual}.`;
  return { ...base, actual, outcome, passed: outcome === 'PASS', steps, explanation: `${verdict} ${reason}` };
}

export function summarize(results: TestResult[]): TestSummary {
  return {
    total: results.length,
    passed: results.filter((r) => r.outcome === 'PASS').length,
    failed: results.filter((r) => r.outcome === 'FAIL').length,
    inconclusive: results.filter((r) => r.outcome === 'INCONCLUSIVE').length,
  };
}

export function runTestSuite(cases: readonly TestCase[], resolve: MachineResolver = registryResolver): TestSuiteResult {
  const results = cases.map((tc) => runTestCase(tc, resolve));
  return { results, summary: summarize(results) };
}
