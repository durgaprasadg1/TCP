import type { ExecutionStatus, ValidationIssue } from '../shared-types';

/**
 * PDA conventions (see README "Algorithms"):
 *
 * - A transition (q, a, X) -> (p, γ) is applicable in configuration (q, i, S) iff
 *     input a is ε, or a equals input[i];
 *     stackTop X is ε (stack is not consulted or popped), or S is non-empty and its top equals X.
 * - Applying it: consume `a` (if not ε), pop X (if not ε), then push γ.
 * - γ is a string of single-character stack symbols written TOP FIRST: γ = "AZ" leaves A on top of Z.
 *   γ = "" (or "ε") pushes nothing, so the transition is a pure pop (or a no-op when X is ε).
 * - To replace the top X with Y keep the rest: (.., X) -> "Y"; to keep X and add Y on top: (.., X) -> "YX".
 * - Stacks are exposed as arrays ordered BOTTOM -> TOP: stack[stack.length - 1] is the top.
 * - The machine starts with exactly one symbol, `initialStackSymbol`, on the stack.
 * - Acceptance requires all input consumed AND
 *     FINAL_STATE: the state is a final state, or
 *     EMPTY_STACK: the stack is empty.
 */
export type AcceptanceMode = 'FINAL_STATE' | 'EMPTY_STACK';

export interface PdaTransition {
  id: string;
  from: string;
  /** Input symbol or ε. */
  input: string;
  /** Required stack-top symbol (popped) or ε. */
  stackTop: string;
  to: string;
  /** Symbols pushed, top first. "" / "ε" pushes nothing. */
  push: string;
}

export interface PdaDefinition {
  kind: 'PDA';
  name: string;
  description?: string;
  states: string[];
  inputAlphabet: string[];
  stackAlphabet: string[];
  startState: string;
  initialStackSymbol: string;
  finalStates: string[];
  acceptanceMode: AcceptanceMode;
  /** When true the validator enforces the DPDA determinism condition. */
  deterministic?: boolean;
  transitions: PdaTransition[];
}

export type PdaConfigStatus = 'ACTIVE' | 'ACCEPTING' | 'DEAD_END' | 'PRUNED' | 'UNEXPANDED';

export interface PdaConfiguration {
  state: string;
  /** Number of input symbols consumed so far. */
  position: number;
  /** Bottom -> top. */
  stack: string[];
  status: PdaConfigStatus;
}

/** One node of the computation tree (one configuration reached by one transition). */
export interface PdaTraceNode {
  id: number;
  parentId: number | null;
  /** Number of transitions applied from the start configuration. */
  depth: number;
  configuration: PdaConfiguration;
  /** Transition applied to reach this node from its parent; null for the root. */
  transitionId: string | null;
}

export type PdaLimit = 'maxConfigurations' | 'maxStackSize' | 'maxDepth';

export interface PdaExecutionOptions {
  /** Maximum number of distinct configurations to create. */
  maxConfigurations?: number;
  /** Configurations whose stack would exceed this size are not explored. */
  maxStackSize?: number;
  /** Maximum number of transitions along any one computation. */
  maxDepth?: number;
  /** Stop at the first accepting configuration (default true). */
  stopOnAccept?: boolean;
  /** Maximum nodes returned in the trace (accepting path is always included). */
  maxTraceNodes?: number;
}

export interface PdaExecutionStats {
  configurationsCreated: number;
  configurationsExpanded: number;
  duplicatesPruned: number;
  prunedByStackLimit: number;
  maxDepthReached: number;
  maxStackSeen: number;
  maxSimultaneous: number;
  limitHit: PdaLimit | null;
}

export interface PdaExecutionResult {
  status: ExecutionStatus;
  /** Plain-language explanation of the verdict. */
  reason: string;
  acceptedBy: AcceptanceMode | null;
  input: string;
  /** Accepting configuration, otherwise the last configuration examined. */
  finalConfiguration: PdaConfiguration | null;
  /** Computation tree nodes (possibly truncated, see traceTruncated). */
  nodes: PdaTraceNode[];
  /** levels[d] = ids of nodes at depth d, i.e. every configuration alive after d steps. */
  levels: number[][];
  /** Node ids from the start configuration to the first accepting configuration. */
  acceptingPath: number[];
  traceTruncated: boolean;
  /** Length of the accepting computation, or the deepest depth explored otherwise. */
  steps: number;
  stats: PdaExecutionStats;
  /** Populated when status is INVALID_MACHINE (and may hold warnings otherwise). */
  issues: ValidationIssue[];
  /** True when the input was rejected before exploration because of an alphabet violation. */
  rejectedByAlphabet: boolean;
}
