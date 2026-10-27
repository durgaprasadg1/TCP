import type { MachineKind } from './shared-types';
import type { PdaDefinition } from './pda/types';
import type { TmDefinition } from './turing-machine/types';
import {
  PDA_ANBN,
  PDA_ANBN_CSTAR,
  PDA_CONFLICTING,
  PDA_EMPTY_STACK_ONLY,
  PDA_EPSILON_CHAIN,
  PDA_EPSILON_CYCLE,
  PDA_INVALID_START,
  PDA_PALINDROME,
  PDA_WCW_REVERSE,
  PDA_PARENTHESES,
  PDA_RUNAWAY,
} from './pda/examples';
import {
  TM_ANBN,
  TM_ANBNCN,
  TM_BOTH_DIRECTIONS,
  TM_CONFLICTING,
  TM_INFINITE_LOOP,
  TM_INVALID_START,
  TM_MISSING_TRANSITION,
  TM_UNARY_INCREMENT,
} from './turing-machine/examples';

interface EntryBase {
  id: string;
  name: string;
  description: string;
  /** "builtin" machines are offered in the labs; "fixture" machines exist for edge-case tests. */
  role: 'builtin' | 'fixture';
  /** Formal description of the recognized language, when there is one. */
  language?: string;
  sampleAccepted: string[];
  sampleRejected: string[];
  defaultInput: string;
}

export interface PdaEntry extends EntryBase {
  kind: 'PDA';
  definition: PdaDefinition;
}

export interface TmEntry extends EntryBase {
  kind: 'TM';
  definition: TmDefinition;
}

export type MachineEntry = PdaEntry | TmEntry;

function pda(id: string, role: EntryBase['role'], definition: PdaDefinition, extra: Partial<EntryBase> = {}): PdaEntry {
  return {
    id,
    kind: 'PDA',
    role,
    name: definition.name,
    description: definition.description ?? '',
    sampleAccepted: [],
    sampleRejected: [],
    defaultInput: '',
    definition,
    ...extra,
  };
}

function tm(id: string, role: EntryBase['role'], definition: TmDefinition, extra: Partial<EntryBase> = {}): TmEntry {
  return {
    id,
    kind: 'TM',
    role,
    name: definition.name,
    description: definition.description ?? '',
    sampleAccepted: [],
    sampleRejected: [],
    defaultInput: '',
    definition,
    ...extra,
  };
}

export const MACHINE_REGISTRY: readonly MachineEntry[] = [
  pda('pda-anbn', 'builtin', PDA_ANBN, {
    language: 'L1 = { aⁿbⁿ | n ≥ 1 }',
    sampleAccepted: ['ab', 'aabb', 'aaabbb', 'aaaabbbb'],
    sampleRejected: ['aab', 'abb', 'abab', 'ba', ''],
    defaultInput: 'aaabbb',
  }),
  pda('pda-parentheses', 'builtin', PDA_PARENTHESES, {
    language: 'Balanced parentheses (Dyck language over "(" and ")")',
    sampleAccepted: ['()', '(())', '()()', '(()())'],
    sampleRejected: ['(', ')', '(()', '())'],
    defaultInput: '(()())',
  }),
  pda('pda-palindrome', 'builtin', PDA_PALINDROME, {
    language: '{ w wᴿ | w ∈ {a,b}* }',
    sampleAccepted: ['', 'aa', 'abba', 'baab', 'abbbba'],
    sampleRejected: ['ab', 'aba', 'abab'],
    defaultInput: 'abba',
  }),
  pda('pda-wcw-reverse', 'builtin', PDA_WCW_REVERSE, {
    language: '{ w c wᴿ | w ∈ {a,b}* }',
    sampleAccepted: ['c', 'aca', 'bcb', 'abcba', 'bacab', 'aabcbaa', 'aabacabaa'],
    sampleRejected: ['acb', 'abca', 'abcab', 'ab', ''],
    defaultInput: 'aabacabaa',
  }),
  pda('pda-anbn-cstar', 'builtin', PDA_ANBN_CSTAR, {
    language: '{ aⁿbⁿcᵐ | n, m ≥ 1 } (NOT aⁿbⁿcⁿ: shows why one stack is not enough)',
    sampleAccepted: ['abc', 'aabbcc', 'aabbc'],
    sampleRejected: ['aabbbcc', 'abcabc', ''],
    defaultInput: 'aabbc',
  }),
  tm('tm-anbn', 'builtin', TM_ANBN, {
    language: 'L1 = { aⁿbⁿ | n ≥ 1 } (on a Turing machine)',
    sampleAccepted: ['ab', 'aabb', 'aaabbb', 'aaaabbbb'],
    sampleRejected: ['aab', 'abb', 'abab', 'ba', ''],
    defaultInput: 'aaabbb',
  }),
  tm('tm-anbncn', 'builtin', TM_ANBNCN, {
    language: 'L2 = { aⁿbⁿcⁿ | n ≥ 1 }',
    sampleAccepted: ['abc', 'aabbcc', 'aaabbbccc', 'aaaabbbbcccc'],
    sampleRejected: ['aabcc', 'aabbccc', 'abbc', 'ababcc', 'baaccc', ''],
    defaultInput: 'aabbcc',
  }),
  tm('tm-unary-increment', 'builtin', TM_UNARY_INCREMENT, {
    language: 'Computes 1ⁿ ↦ 1ⁿ⁺¹ (accepts every unary input)',
    sampleAccepted: ['', '1', '111'],
    sampleRejected: [],
    defaultInput: '111',
  }),

  pda('pda-epsilon-chain', 'fixture', PDA_EPSILON_CHAIN),
  pda('pda-epsilon-cycle', 'fixture', PDA_EPSILON_CYCLE),
  pda('pda-runaway', 'fixture', PDA_RUNAWAY),
  pda('pda-conflicting', 'fixture', PDA_CONFLICTING),
  pda('pda-invalid-start', 'fixture', PDA_INVALID_START),
  pda('pda-empty-stack-only', 'fixture', PDA_EMPTY_STACK_ONLY),
  tm('tm-missing-transition', 'fixture', TM_MISSING_TRANSITION),
  tm('tm-infinite-loop', 'fixture', TM_INFINITE_LOOP),
  tm('tm-both-directions', 'fixture', TM_BOTH_DIRECTIONS),
  tm('tm-conflicting', 'fixture', TM_CONFLICTING),
  tm('tm-invalid-start', 'fixture', TM_INVALID_START),
];

export function getMachine(id: string): MachineEntry | undefined {
  return MACHINE_REGISTRY.find((m) => m.id === id);
}

export function listMachines(kind?: MachineKind, role: EntryBase['role'] = 'builtin'): MachineEntry[] {
  return MACHINE_REGISTRY.filter((m) => m.role === role && (kind === undefined || m.kind === kind));
}
