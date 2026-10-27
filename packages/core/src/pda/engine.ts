import { isEpsilon } from '../shared-types';
import type { ExecutionStatus } from '../shared-types';
import { show } from '../validation/common';
import type {
  PdaConfigStatus,
  PdaConfiguration,
  PdaDefinition,
  PdaExecutionOptions,
  PdaExecutionResult,
  PdaExecutionStats,
  PdaLimit,
  PdaTraceNode,
  PdaTransition,
} from './types';
import { validatePda } from './validate';

export const DEFAULT_PDA_OPTIONS: Required<PdaExecutionOptions> = {
  maxConfigurations: 20_000,
  maxStackSize: 500,
  maxDepth: 5_000,
  stopOnAccept: true,
  maxTraceNodes: 2_000,
};

/** Hard ceilings an untrusted caller (the API) can never exceed. */
export const PDA_OPTION_CEILINGS = {
  maxConfigurations: 50_000,
  maxStackSize: 500,
  maxDepth: 20_000,
  maxTraceNodes: 5_000,
} as const;

function resolveOptions(options: PdaExecutionOptions): Required<PdaExecutionOptions> {
  const pick = (v: number | undefined, d: number) =>
    v !== undefined && Number.isFinite(v) && v >= 1 ? Math.floor(v) : d;
  return {
    maxConfigurations: pick(options.maxConfigurations, DEFAULT_PDA_OPTIONS.maxConfigurations),
    maxStackSize: pick(options.maxStackSize, DEFAULT_PDA_OPTIONS.maxStackSize),
    maxDepth: pick(options.maxDepth, DEFAULT_PDA_OPTIONS.maxDepth),
    stopOnAccept: options.stopOnAccept ?? DEFAULT_PDA_OPTIONS.stopOnAccept,
    maxTraceNodes: pick(options.maxTraceNodes, DEFAULT_PDA_OPTIONS.maxTraceNodes),
  };
}

/** Internal node. The stack is a string, bottom -> top (top is the last character). */
interface RawNode {
  id: number;
  parentId: number | null;
  depth: number;
  state: string;
  position: number;
  stack: string;
  transitionId: string | null;
  status: PdaConfigStatus;
}

function emptyStats(): PdaExecutionStats {
  return {
    configurationsCreated: 0,
    configurationsExpanded: 0,
    duplicatesPruned: 0,
    prunedByStackLimit: 0,
    maxDepthReached: 0,
    maxStackSeen: 0,
    maxSimultaneous: 0,
    limitHit: null,
  };
}

function toConfiguration(n: RawNode): PdaConfiguration {
  return { state: n.state, position: n.position, stack: Array.from(n.stack), status: n.status };
}

/** Reverse a push string so the leftmost character ends up on top (last in our stack string). */
function pushedSegment(push: string): string {
  return isEpsilon(push) ? '' : Array.from(push).reverse().join('');
}

function stackToText(stack: string): string {
  return stack === '' ? '(empty)' : `[${Array.from(stack).join(' ')}] (top = ${stack[stack.length - 1]})`;
}

/**
 * Nondeterministic PDA simulation by breadth-first exploration of the configuration graph.
 *
 * Every applicable transition of every live configuration is followed, so the engine never
 * commits to "the first match". Distinct configurations (state, position, stack) are
 * visited once, which makes epsilon-cycles terminate. Because stacks can grow without bound the
 * reachable configuration set may be infinite; the budget in `options` bounds the work and the
 * engine answers INCONCLUSIVE (never REJECTED) if the budget is exhausted without finding an
 * accepting configuration.
 *
 * REJECTED is returned only when exploration finished and every reachable configuration was examined.
 */
export function executePda(
  def: PdaDefinition,
  input: string,
  options: PdaExecutionOptions = {},
): PdaExecutionResult {
  const opts = resolveOptions(options);
  const stats = emptyStats();

  const base = {
    input,
    acceptedBy: null,
    finalConfiguration: null,
    nodes: [] as PdaTraceNode[],
    levels: [] as number[][],
    acceptingPath: [] as number[],
    traceTruncated: false,
    steps: 0,
    stats,
    rejectedByAlphabet: false,
  };

  const validation = validatePda(def);
  if (!validation.valid) {
    const errors = validation.issues.filter((i) => i.severity === 'error');
    return {
      ...base,
      status: 'INVALID_MACHINE',
      reason: `The machine definition is invalid (${errors.length} error${errors.length === 1 ? '' : 's'}): ${errors[0]?.message ?? ''}`,
      issues: validation.issues,
    };
  }

  // Alphabet pre-validation (documented): a string with foreign symbols is not a word over the input alphabet.
  const alphabet = new Set(def.inputAlphabet);
  const chars = Array.from(input);
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i] as string;
    if (!alphabet.has(c)) {
      return {
        ...base,
        status: 'REJECTED',
        reason: `Input symbol ${show(c)} at position ${i} is not in the input alphabet {${def.inputAlphabet.join(', ')}}; the input was rejected without running any transition.`,
        issues: validation.issues,
        rejectedByAlphabet: true,
      };
    }
  }

  const finalStates = new Set(def.finalStates);
  const byState = new Map<string, PdaTransition[]>();
  for (const t of def.transitions) {
    const list = byState.get(t.from);
    if (list) list.push(t);
    else byState.set(t.from, [t]);
  }
  const pushSegments = new Map<string, string>(def.transitions.map((t) => [t.id, pushedSegment(t.push)]));

  const isAccepting = (n: RawNode): boolean =>
    n.position === chars.length &&
    (def.acceptanceMode === 'FINAL_STATE' ? finalStates.has(n.state) : n.stack.length === 0);

  const nodes: RawNode[] = [];
  const visited = new Set<string>();
  const queue: number[] = [];
  let queueHead = 0;
  // Held in an object so TypeScript does not narrow values that closures mutate.
  const ctl: { acceptingId: number | null; done: boolean } = { acceptingId: null, done: false };

  const keyOf = (state: string, position: number, stack: string) => `${state}\u0000${position}\u0000${stack}`;

  const create = (parentId: number | null, depth: number, state: string, position: number, stack: string, transitionId: string | null) => {
    const node: RawNode = { id: nodes.length, parentId, depth, state, position, stack, transitionId, status: 'ACTIVE' };
    nodes.push(node);
    visited.add(keyOf(state, position, stack));
    queue.push(node.id);
    stats.maxDepthReached = Math.max(stats.maxDepthReached, depth);
    stats.maxStackSeen = Math.max(stats.maxStackSeen, stack.length);
    stats.maxSimultaneous = Math.max(stats.maxSimultaneous, queue.length - queueHead);
    if (ctl.acceptingId === null && isAccepting(node)) {
      ctl.acceptingId = node.id;
      if (opts.stopOnAccept) ctl.done = true;
    }
    return node;
  };

  const noteLimit = (limit: PdaLimit) => {
    if (stats.limitHit === null) stats.limitHit = limit;
  };

  create(null, 0, def.startState, 0, def.initialStackSymbol, null);

  let lastExamined: RawNode = nodes[0] as RawNode;

  while (queueHead < queue.length && !ctl.done) {
    const node = nodes[queue[queueHead++] as number] as RawNode;
    lastExamined = node;
    stats.configurationsExpanded++;

    if (node.depth >= opts.maxDepth) {
      node.status = 'PRUNED';
      noteLimit('maxDepth');
      continue;
    }

    const top = node.stack.length > 0 ? node.stack[node.stack.length - 1] : undefined;
    const nextInput = node.position < chars.length ? chars[node.position] : undefined;
    let applicable = 0;

    for (const t of byState.get(node.state) ?? []) {
      const readsInput = !isEpsilon(t.input);
      if (readsInput && t.input !== nextInput) continue;
      const popsStack = !isEpsilon(t.stackTop);
      if (popsStack && t.stackTop !== top) continue;
      applicable++;

      const remaining = popsStack ? node.stack.slice(0, -1) : node.stack;
      const newStack = remaining + (pushSegments.get(t.id) ?? '');
      const newPos = node.position + (readsInput ? 1 : 0);

      if (newStack.length > opts.maxStackSize) {
        stats.prunedByStackLimit++;
        noteLimit('maxStackSize');
        continue;
      }
      if (visited.has(keyOf(t.to, newPos, newStack))) {
        stats.duplicatesPruned++;
        continue;
      }
      if (nodes.length >= opts.maxConfigurations) {
        noteLimit('maxConfigurations');
        ctl.done = true;
        break;
      }
      create(node.id, node.depth + 1, t.to, newPos, newStack, t.id);
      if (ctl.done) break;
    }

    if (isAccepting(node)) node.status = 'ACCEPTING';
    else if (applicable === 0) node.status = 'DEAD_END';
    // else stays ACTIVE (expanded; children carry the computation forward)
  }

  // Anything still queued was never expanded.
  for (let i = queueHead; i < queue.length; i++) {
    const n = nodes[queue[i] as number] as RawNode;
    if (n.status === 'ACTIVE') n.status = isAccepting(n) ? 'ACCEPTING' : 'UNEXPANDED';
  }
  const acceptingId = ctl.acceptingId;
  // An accepting node found right at creation is marked even if its expansion was skipped.
  if (acceptingId !== null) (nodes[acceptingId] as RawNode).status = 'ACCEPTING';

  stats.configurationsCreated = nodes.length;

  // ----- verdict -----
  let status: ExecutionStatus;
  let reason: string;
  let acceptedBy: PdaExecutionResult['acceptedBy'] = null;
  let finalNode: RawNode = lastExamined;

  if (acceptingId !== null) {
    status = 'ACCEPTED';
    const n = nodes[acceptingId] as RawNode;
    finalNode = n;
    acceptedBy = def.acceptanceMode;
    reason =
      def.acceptanceMode === 'FINAL_STATE'
        ? `Accepted: all ${chars.length} input symbol(s) were consumed and the machine is in final state '${n.state}' after ${n.depth} transition(s).`
        : `Accepted: all ${chars.length} input symbol(s) were consumed and the stack is empty after ${n.depth} transition(s).`;
  } else if (stats.limitHit !== null) {
    status = 'INCONCLUSIVE';
    const what: Record<PdaLimit, string> = {
      maxConfigurations: `the configuration budget (${opts.maxConfigurations}) was exhausted`,
      maxStackSize: `some branches needed a stack larger than the limit (${opts.maxStackSize}) and were not explored`,
      maxDepth: `some computations reached the depth limit (${opts.maxDepth})`,
    };
    reason = `Inconclusive: ${what[stats.limitHit]} before an accepting configuration was found. This is not a rejection: unexplored configurations might still accept.`;
  } else {
    status = 'REJECTED';
    reason = `Rejected: exploration finished after examining all ${nodes.length} reachable configuration(s) (${stats.duplicatesPruned} duplicate(s) pruned) and none consumes the entire input while satisfying ${
      def.acceptanceMode === 'FINAL_STATE' ? 'final-state' : 'empty-stack'
    } acceptance.`;
    if (chars.length > 0 && stats.maxDepthReached === 0) {
      reason += ' No transition applied to the start configuration.';
    }
  }

  // ----- accepting path -----
  const acceptingPath: number[] = [];
  if (acceptingId !== null) {
    for (let cur: number | null = acceptingId; cur !== null; cur = (nodes[cur] as RawNode).parentId) acceptingPath.unshift(cur);
  }

  // ----- trace (bounded) -----
  const include = new Set<number>(acceptingPath);
  for (let i = 0; i < Math.min(nodes.length, opts.maxTraceNodes); i++) include.add(i);
  const traceTruncated = include.size < nodes.length;
  const traceNodes: PdaTraceNode[] = [...include]
    .sort((a, b) => a - b)
    .map((id) => {
      const n = nodes[id] as RawNode;
      return { id: n.id, parentId: n.parentId, depth: n.depth, configuration: toConfiguration(n), transitionId: n.transitionId };
    });
  const levels: number[][] = [];
  for (const n of traceNodes) {
    (levels[n.depth] ??= []).push(n.id);
  }
  for (let d = 0; d < levels.length; d++) levels[d] ??= [];

  const steps = acceptingId !== null ? (nodes[acceptingId] as RawNode).depth : stats.maxDepthReached;

  return {
    status,
    reason,
    acceptedBy,
    input,
    finalConfiguration: toConfiguration(finalNode),
    nodes: traceNodes,
    levels,
    acceptingPath,
    traceTruncated,
    steps,
    stats,
    issues: validation.issues,
    rejectedByAlphabet: false,
  };
}

/** Render a configuration for logs and error messages: (state, remaining input, stack). */
export function describePdaConfiguration(c: PdaConfiguration, input: string): string {
  const rest = Array.from(input).slice(c.position).join('');
  return `(${c.state}, ${rest === '' ? 'ε' : rest}, ${stackToText(c.stack.join(''))})`;
}
