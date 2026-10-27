import { BUILTIN_TEST_CASES, parsePdaDefinition, parseTmDefinition, runTestSuite } from '@cw/core';
import type { PdaDefinition, TestCase, TestSuiteResult, TmDefinition } from '@cw/core';
import { HttpError } from '../middleware/errors';
import type { TestRunBody } from '../schemas/requests';

const CUSTOM_ID = 'custom';

/**
 * Runs built-in test cases (optionally filtered by id or category) and/or a caller-supplied machine
 * with caller-supplied expectations. Every verdict is produced by the engines; this layer only selects cases.
 */
export function runTests(body: TestRunBody): TestSuiteResult {
  if (body.custom) {
    const { kind, machine, cases, options } = body.custom;
    let definition: PdaDefinition | TmDefinition;
    if (kind === 'PDA') {
      const parsed = parsePdaDefinition(machine);
      if (!parsed.success) throw new HttpError(400, 'MALFORMED_MACHINE', 'The custom machine is malformed.', parsed.issues);
      definition = parsed.data;
    } else {
      const parsed = parseTmDefinition(machine);
      if (!parsed.success) throw new HttpError(400, 'MALFORMED_MACHINE', 'The custom machine is malformed.', parsed.issues);
      definition = parsed.data;
    }
    const testCases: TestCase[] = cases.map((c, i) => ({
      id: `custom#${String(i + 1).padStart(3, '0')}`,
      machineId: CUSTOM_ID,
      machineKind: kind,
      category: 'Custom machine',
      description: c.description ?? `Custom case ${i + 1}`,
      input: c.input,
      expected: c.expected,
      ...(options ? { options } : {}),
    }));
    return runTestSuite(testCases, (id) => (id === CUSTOM_ID ? definition : undefined));
  }

  let selected: readonly TestCase[] = BUILTIN_TEST_CASES;
  if (body.testIds) {
    const ids = new Set(body.testIds);
    selected = selected.filter((t) => ids.has(t.id));
  }
  if (body.categories) {
    const cats = new Set(body.categories);
    selected = selected.filter((t) => cats.has(t.category));
  }
  return runTestSuite(selected);
}
