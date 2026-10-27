import { show } from '../validation/common';
import { SparseTape } from './tape';
import type {
  TmAppliedTransition,
  TmConfiguration,
  TmDefinition,
  TmExecutionOptions,
  TmExecutionResult,
  TmHaltReason,
  TmTransition,
} from './types';
import { validateTm } from './validate';
import type { ExecutionStatus } from '../shared-types';

export const DEFAULT_TM_OPTIONS: Required<TmExecutionOptions> = {
  maxSteps: 10_000,
  maxTraceSteps: 2_000,
};

/** Hard ceilings an untrusted caller (the API) can never exceed. */
export const TM_OPTION_CEILINGS = {
  maxSteps: 200_000,
  maxTraceSteps: 5_000,
} as const;

function resolveOptions(options: TmExecutionOptions): Required<TmExecutionOptions> {
  const pick = (v: number | undefined, d: number) => (v !== undefined && Number.isFinite(v) && v >= 1 ? Math.floor(v) : d);
  return {
    maxSteps: pick(options.maxSteps, DEFAULT_TM_OPTIONS.maxSteps),
    maxTraceSteps: pick(options.maxTraceSteps, DEFAULT_TM_OPTIONS.maxTraceSteps),
  };
}

function applied(t: TmTransition): TmAppliedTransition {
  return { id: t.id, from: t.from, read: t.read, to: t.to, write: t.write, move: t.move };
}

/**
 * Runs a deterministic single-tape Turing Machine.
 *
 * Outcomes:
 *  - ACCEPTED: an accept state was entered.
 *  - REJECTED: a reject state was entered, or no transition exists for (state, symbol) ("implicit reject").
 *  - INCONCLUSIVE: `maxSteps` transitions were applied without halting. Nothing is proved about halting.
 *  - INVALID_MACHINE: the definition failed validation; nothing was executed.
 *
 * The halting check precedes the step-limit check, so entering a halting state on exactly the last
 * permitted step is still reported as a halt.
 */
export function executeTm(def: TmDefinition, input: string, options: TmExecutionOptions = {}): TmExecutionResult {
  const opts = resolveOptions(options);

  const empty = (
    status: ExecutionStatus,
    haltReason: TmHaltReason,
    reason: string,
    issues: TmExecutionResult['issues'],
    rejectedByAlphabet = false,
  ): TmExecutionResult => ({
    status,
    haltReason,
    reason,
    input,
    steps: 0,
    configurations: [],
    traceTruncated: false,
    finalConfiguration: null,
    finalTapeContent: '',
    missingTransition: null,
    issues,
    rejectedByAlphabet,
  });

  const validation = validateTm(def);
  if (!validation.valid) {
    const errors = validation.issues.filter((i) => i.severity === 'error');
    return empty(
      'INVALID_MACHINE',
      'INVALID_MACHINE',
      `The machine definition is invalid (${errors.length} error${errors.length === 1 ? '' : 's'}): ${errors[0]?.message ?? ''}`,
      validation.issues,
    );
  }

  const alphabet = new Set(def.inputAlphabet);
  for (let i = 0; i < input.length; i++) {
    const c = input[i] as string;
    if (!alphabet.has(c)) {
      return empty(
        'REJECTED',
        'INPUT_ALPHABET',
        `Input symbol ${show(c)} at position ${i} is not in the input alphabet {${def.inputAlphabet.join(', ')}}; the input was rejected without running any transition.`,
        validation.issues,
        true,
      );
    }
  }

  const table = new Map<string, TmTransition>();
  for (const t of def.transitions) table.set(JSON.stringify([t.from, t.read]), t);
  const accept = new Set(def.acceptStates);
  const reject = new Set(def.rejectStates);

  const tape = SparseTape.fromInput(input, def.blank, def.tapeModel ?? 'TWO_WAY_INFINITE');
  let state = def.startState;
  let head = 0;
  let step = 0;

  const configurations: TmConfiguration[] = [];
  let traceTruncated = false;
  const snapshot = (a: TmAppliedTransition | null): TmConfiguration => ({
    step,
    state,
    head,
    symbolUnderHead: tape.read(head),
    tape: tape.snapshot(head),
    applied: a,
  });
  const record = (cfg: TmConfiguration) => {
    if (configurations.length < opts.maxTraceSteps) configurations.push(cfg);
    else traceTruncated = true;
  };

  let last = snapshot(null);
  record(last);

  let status: ExecutionStatus;
  let haltReason: TmHaltReason;
  let reason: string;
  let missing: TmExecutionResult['missingTransition'] = null;

  for (;;) {
    if (accept.has(state)) {
      status = 'ACCEPTED';
      haltReason = 'ACCEPT_STATE';
      reason = `Accepted: the machine entered accept state '${state}' after ${step} step(s).`;
      break;
    }
    if (reject.has(state)) {
      status = 'REJECTED';
      haltReason = 'REJECT_STATE';
      reason = `Rejected: the machine entered reject state '${state}' after ${step} step(s).`;
      break;
    }
    if (step >= opts.maxSteps) {
      status = 'INCONCLUSIVE';
      haltReason = 'STEP_LIMIT';
      reason = `Inconclusive: the step limit (${opts.maxSteps}) was reached while the machine was still running in state '${state}'. A finite simulation cannot tell whether it would eventually halt.`;
      break;
    }
    const symbol = tape.read(head);
    const t = table.get(JSON.stringify([state, symbol]));
    if (!t) {
      status = 'REJECTED';
      haltReason = 'MISSING_TRANSITION';
      missing = { state, symbol };
      reason = `Rejected: no transition is defined for state '${state}' reading ${show(symbol)} (implicit reject), after ${step} step(s).`;
      break;
    }
    tape.write(head, t.write);
    head = tape.move(head, t.move);
    state = t.to;
    step++;
    last = snapshot(applied(t));
    record(last);
  }

  // Always keep the final configuration in the trace, even if the middle was dropped.
  if (traceTruncated) configurations.push(last);

  return {
    status,
    haltReason,
    reason,
    input,
    steps: step,
    configurations,
    traceTruncated,
    finalConfiguration: last,
    finalTapeContent: tape.content(),
    missingTransition: missing,
    issues: validation.issues,
    rejectedByAlphabet: false,
  };
}
