import { makeValidationResult } from '../shared-types';
import type { ValidationIssue, ValidationResult } from '../shared-types';
import { findDuplicates, isSingleSymbol, issue, show } from '../validation/common';
import type { TmDefinition } from './types';

const DIRECTIONS = new Set(['L', 'R', 'S']);

/** Semantic validation of a TM definition. Never mutates or repairs the definition. */
export function validateTm(def: TmDefinition): ValidationResult {
  const issues: ValidationIssue[] = [];
  const states = new Set(def.states);
  const tapeAlphabet = new Set(def.tapeAlphabet);
  const accept = new Set(def.acceptStates);
  const reject = new Set(def.rejectStates);

  // --- states ---
  if (def.states.length === 0) {
    issues.push(issue('error', 'NO_STATES', 'The machine has no states. Add at least one state.', 'states'));
  }
  def.states.forEach((s, i) => {
    if (s.trim() === '') issues.push(issue('error', 'EMPTY_STATE_NAME', 'State names must not be empty.', `states[${i}]`));
  });
  for (const d of findDuplicates(def.states)) {
    issues.push(issue('error', 'DUPLICATE_STATE', `State '${d}' is declared more than once.`, 'states'));
  }
  if (!states.has(def.startState)) {
    issues.push(
      issue('error', 'START_STATE_UNKNOWN', `Start state '${def.startState}' is not in the state set. Choose one of the declared states.`, 'startState'),
    );
  }
  def.acceptStates.forEach((s, i) => {
    if (!states.has(s)) issues.push(issue('error', 'ACCEPT_STATE_UNKNOWN', `Accept state '${s}' is not in the state set.`, `acceptStates[${i}]`));
  });
  def.rejectStates.forEach((s, i) => {
    if (!states.has(s)) issues.push(issue('error', 'REJECT_STATE_UNKNOWN', `Reject state '${s}' is not in the state set.`, `rejectStates[${i}]`));
  });
  for (const s of accept) {
    if (reject.has(s)) {
      issues.push(issue('error', 'ACCEPT_REJECT_OVERLAP', `State '${s}' cannot be both an accept state and a reject state.`));
    }
  }
  if (def.acceptStates.length === 0) {
    issues.push(issue('warning', 'NO_ACCEPT_STATE', 'There is no accept state, so the machine can never answer ACCEPTED.', 'acceptStates'));
  }
  if (accept.has(def.startState) || reject.has(def.startState)) {
    issues.push(issue('info', 'START_IS_HALTING', 'The start state is a halting state: the machine stops immediately on every input.', 'startState'));
  }

  // --- alphabets ---
  const checkSymbols = (name: 'inputAlphabet' | 'tapeAlphabet', symbols: string[]) => {
    symbols.forEach((s, i) => {
      if (!isSingleSymbol(s)) {
        issues.push(issue('error', 'SYMBOL_NOT_SINGLE_CHAR', `Symbol ${show(s)} in ${name} must be exactly one character.`, `${name}[${i}]`));
      }
    });
    for (const d of findDuplicates(symbols)) {
      issues.push(issue('error', 'DUPLICATE_SYMBOL', `Symbol ${show(d)} appears more than once in ${name}.`, name));
    }
  };
  checkSymbols('inputAlphabet', def.inputAlphabet);
  checkSymbols('tapeAlphabet', def.tapeAlphabet);

  if (!isSingleSymbol(def.blank)) {
    issues.push(issue('error', 'SYMBOL_NOT_SINGLE_CHAR', `The blank symbol ${show(def.blank)} must be exactly one character.`, 'blank'));
  }
  if (!tapeAlphabet.has(def.blank)) {
    issues.push(issue('error', 'BLANK_NOT_IN_TAPE_ALPHABET', `The blank symbol ${show(def.blank)} must belong to the tape alphabet.`, 'blank'));
  }
  if (def.inputAlphabet.includes(def.blank)) {
    issues.push(issue('error', 'BLANK_IN_INPUT_ALPHABET', `The blank symbol ${show(def.blank)} must not belong to the input alphabet.`, 'inputAlphabet'));
  }
  for (const s of def.inputAlphabet) {
    if (!tapeAlphabet.has(s)) {
      issues.push(issue('error', 'INPUT_NOT_IN_TAPE_ALPHABET', `Input symbol ${show(s)} must also be in the tape alphabet.`, 'inputAlphabet'));
    }
  }

  // --- transitions ---
  const ids = new Set<string>();
  const byKey = new Map<string, { id: string; sig: string }>();
  def.transitions.forEach((t, i) => {
    const p = `transitions[${i}]`;
    if (ids.has(t.id)) {
      issues.push(issue('error', 'DUPLICATE_TRANSITION_ID', `Transition id '${t.id}' is used more than once.`, `${p}.id`));
    }
    ids.add(t.id);
    if (!states.has(t.from)) {
      issues.push(issue('error', 'TRANSITION_STATE_UNKNOWN', `Transition ${t.id}: source state '${t.from}' is not declared.`, `${p}.from`));
    }
    if (!states.has(t.to)) {
      issues.push(issue('error', 'TRANSITION_STATE_UNKNOWN', `Transition ${t.id}: target state '${t.to}' is not declared.`, `${p}.to`));
    }
    if (!tapeAlphabet.has(t.read)) {
      issues.push(issue('error', 'TRANSITION_READ_UNKNOWN', `Transition ${t.id}: read symbol ${show(t.read)} is not in the tape alphabet.`, `${p}.read`));
    }
    if (!tapeAlphabet.has(t.write)) {
      issues.push(issue('error', 'TRANSITION_WRITE_UNKNOWN', `Transition ${t.id}: write symbol ${show(t.write)} is not in the tape alphabet.`, `${p}.write`));
    }
    if (!DIRECTIONS.has(t.move)) {
      issues.push(issue('error', 'TRANSITION_MOVE_INVALID', `Transition ${t.id}: direction '${t.move}' must be L, R or S.`, `${p}.move`));
    }
    if (accept.has(t.from) || reject.has(t.from)) {
      issues.push(
        issue('warning', 'TRANSITION_FROM_HALTING_STATE', `Transition ${t.id} leaves halting state '${t.from}' and will never be used.`, `${p}.from`),
      );
    }

    const key = JSON.stringify([t.from, t.read]);
    const sig = JSON.stringify([t.to, t.write, t.move]);
    const prev = byKey.get(key);
    if (prev) {
      if (prev.sig === sig) {
        issues.push(issue('error', 'DUPLICATE_TRANSITION', `Transition ${t.id} duplicates transition ${prev.id}. Remove one of them.`, p));
      } else {
        issues.push(
          issue(
            'error',
            'CONFLICTING_TRANSITIONS',
            `Transitions ${prev.id} and ${t.id} both match (${t.from}, ${show(t.read)}) but do different things. A deterministic TM allows only one.`,
            p,
          ),
        );
      }
    } else {
      byKey.set(key, { id: t.id, sig });
    }
  });

  // --- completeness (informational) ---
  if (states.has(def.startState)) {
    const halting = new Set([...accept, ...reject]);
    let undefinedPairs = 0;
    for (const s of def.states) {
      if (halting.has(s)) continue;
      for (const sym of def.tapeAlphabet) {
        if (!byKey.has(JSON.stringify([s, sym]))) undefinedPairs++;
      }
    }
    if (undefinedPairs > 0) {
      issues.push(
        issue(
          'info',
          'INCOMPLETE_TABLE',
          `${undefinedPairs} (state, symbol) pair(s) have no transition. Reaching one of them halts the machine with REJECTED (implicit reject).`,
        ),
      );
    }
  }

  return makeValidationResult(issues);
}
