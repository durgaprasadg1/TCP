import type { ExecutionStatus, ValidationIssue } from '../shared-types';

/**
 * TM conventions (see README "Algorithms"):
 *
 * - Deterministic, single tape, transitions (q, read) -> (p, write, move) with move in {L, R, S}.
 *   S ("stay") is an extension that is convenient for hand-written machines.
 * - The input is written on cells 0 .. n-1; every other cell is blank. The head starts on cell 0.
 * - TWO_WAY_INFINITE (default): the tape extends without bound in both directions. Cells never written hold the blank.
 *   LEFT_BOUNDED (Sipser's model): cell 0 is the left end; a move L from cell 0 leaves the head on cell 0.
 * - A machine halts the moment it enters an accept or reject state (transitions out of such states are never used).
 * - MISSING TRANSITION: if the machine is in a non-halting state and no transition is defined for
 *   (state, symbol under head), it halts and REJECTS (the usual "implicit reject" convention).
 *   The result carries haltReason "MISSING_TRANSITION" so it can be told apart from entering a reject state.
 * - STEP LIMIT: if `maxSteps` transitions have been applied without halting the answer is INCONCLUSIVE.
 *   A finite simulation can never prove that a machine runs forever.
 */
export type Direction = 'L' | 'R' | 'S';
export type TapeModel = 'TWO_WAY_INFINITE' | 'LEFT_BOUNDED';

export interface TmTransition {
  id: string;
  from: string;
  read: string;
  to: string;
  write: string;
  move: Direction;
}

export interface TmDefinition {
  kind: 'TM';
  name: string;
  description?: string;
  states: string[];
  inputAlphabet: string[];
  tapeAlphabet: string[];
  blank: string;
  startState: string;
  acceptStates: string[];
  rejectStates: string[];
  tapeModel?: TapeModel;
  transitions: TmTransition[];
}

/** A window of the tape: cells[i] is the symbol at tape position origin + i. */
export interface TapeSnapshot {
  origin: number;
  cells: string[];
  /** True when non-blank content outside this window was omitted from the snapshot. */
  clippedLeft: boolean;
  clippedRight: boolean;
}

export interface TmAppliedTransition {
  id: string;
  from: string;
  read: string;
  to: string;
  write: string;
  move: Direction;
}

export interface TmConfiguration {
  /** Number of transitions applied so far (0 = initial configuration). */
  step: number;
  state: string;
  /** Head position (may be negative on a two-way infinite tape). */
  head: number;
  /** Symbol under the head in this configuration. */
  symbolUnderHead: string;
  tape: TapeSnapshot;
  /** The transition applied to reach this configuration; null for the initial one. */
  applied: TmAppliedTransition | null;
}

export type TmHaltReason =
  | 'ACCEPT_STATE'
  | 'REJECT_STATE'
  | 'MISSING_TRANSITION'
  | 'STEP_LIMIT'
  | 'INVALID_MACHINE'
  | 'INPUT_ALPHABET';

export interface TmExecutionOptions {
  /** Maximum number of transitions to apply. */
  maxSteps?: number;
  /** Maximum number of configurations kept in the trace (first ones + the final one). */
  maxTraceSteps?: number;
}

export interface TmExecutionResult {
  status: ExecutionStatus;
  haltReason: TmHaltReason;
  reason: string;
  input: string;
  /** Number of transitions applied. */
  steps: number;
  configurations: TmConfiguration[];
  traceTruncated: boolean;
  finalConfiguration: TmConfiguration | null;
  /** Tape contents between the first and last non-blank cell of the final tape. */
  finalTapeContent: string;
  /** Set when haltReason is MISSING_TRANSITION. */
  missingTransition: { state: string; symbol: string } | null;
  issues: ValidationIssue[];
  rejectedByAlphabet: boolean;
}
