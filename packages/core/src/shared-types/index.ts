/**
 * Shared types used by both machine engines, the API and the web UI.
 *
 * This module must stay free of React, Express and browser APIs.
 */

/** Canonical epsilon (empty string) symbol. The empty string "" is accepted as a synonym on input. */
export const EPSILON = 'ε';

/** True when `s` denotes epsilon ("ε" or the empty string). */
export function isEpsilon(s: string): boolean {
  return s === EPSILON || s === '';
}

export type MachineKind = 'PDA' | 'TM';

/**
 * Outcome of a finite simulation.
 *
 * ACCEPTED / REJECTED are only reported when the engine has actually established them.
 * INCONCLUSIVE means a resource budget ran out first: it is NOT a rejection.
 */
export type ExecutionStatus = 'ACCEPTED' | 'REJECTED' | 'INCONCLUSIVE' | 'INVALID_MACHINE';

export const EXECUTION_STATUSES: readonly ExecutionStatus[] = [
  'ACCEPTED',
  'REJECTED',
  'INCONCLUSIVE',
  'INVALID_MACHINE',
];

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: IssueSeverity;
  /** Stable machine-readable code, e.g. "START_STATE_UNKNOWN". */
  code: string;
  /** Actionable human-readable message. */
  message: string;
  /** Optional location such as "transitions[3].to". */
  path?: string;
}

export interface ValidationResult {
  /** True when there are no issues with severity "error". */
  valid: boolean;
  issues: ValidationIssue[];
}

export function makeValidationResult(issues: ValidationIssue[]): ValidationResult {
  return { valid: !issues.some((i) => i.severity === 'error'), issues };
}

/** A single test case run by the test runner. */
export interface TestCase {
  id: string;
  machineId: string;
  machineKind: MachineKind;
  category: string;
  description: string;
  input: string;
  expected: ExecutionStatus;
  /** Optional engine budget overrides (used to provoke INCONCLUSIVE on purpose). */
  options?: { maxSteps?: number; maxConfigurations?: number; maxStackSize?: number; maxDepth?: number };
}

/**
 * PASS: actual === expected.
 * FAIL: actual differs from expected and is a definite verdict (ACCEPTED/REJECTED/INVALID_MACHINE).
 * INCONCLUSIVE: the engine hit a budget although a definite verdict was expected.
 */
export type TestOutcome = 'PASS' | 'FAIL' | 'INCONCLUSIVE';

export interface TestResult {
  testId: string;
  machineId: string;
  machineKind: MachineKind;
  category: string;
  description: string;
  input: string;
  expected: ExecutionStatus;
  actual: ExecutionStatus;
  outcome: TestOutcome;
  passed: boolean;
  steps: number | null;
  explanation: string;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  inconclusive: number;
}
