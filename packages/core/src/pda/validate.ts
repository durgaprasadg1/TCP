import { isEpsilon, makeValidationResult } from '../shared-types';
import type { ValidationIssue, ValidationResult } from '../shared-types';
import { findDuplicates, isSingleSymbol, issue, show } from '../validation/common';
import type { PdaDefinition, PdaTransition } from './types';

/** Two transitions from the same state can both apply to some configuration. */
function overlaps(a: PdaTransition, b: PdaTransition): boolean {
  const inputsOverlap = isEpsilon(a.input) || isEpsilon(b.input) || a.input === b.input;
  const stacksOverlap = isEpsilon(a.stackTop) || isEpsilon(b.stackTop) || a.stackTop === b.stackTop;
  return inputsOverlap && stacksOverlap;
}

/**
 * Semantic validation of a PDA definition. Never mutates or repairs the definition.
 * Errors make the machine non-executable; warnings and infos are advisory.
 */
export function validatePda(def: PdaDefinition): ValidationResult {
  const issues: ValidationIssue[] = [];
  const states = new Set(def.states);
  const inputAlphabet = new Set(def.inputAlphabet);
  const stackAlphabet = new Set(def.stackAlphabet);

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
  def.finalStates.forEach((f, i) => {
    if (!states.has(f)) {
      issues.push(issue('error', 'FINAL_STATE_UNKNOWN', `Final state '${f}' is not in the state set.`, `finalStates[${i}]`));
    }
  });
  if (def.acceptanceMode === 'FINAL_STATE' && def.finalStates.length === 0) {
    issues.push(
      issue('warning', 'NO_FINAL_STATES', 'Acceptance is by final state but no final state is defined, so no input can ever be accepted.', 'finalStates'),
    );
  }

  // --- alphabets ---
  const checkAlphabet = (name: 'inputAlphabet' | 'stackAlphabet', symbols: string[]) => {
    symbols.forEach((s, i) => {
      if (isEpsilon(s)) {
        issues.push(issue('error', 'EPSILON_IN_ALPHABET', `ε cannot be a member of the ${name}.`, `${name}[${i}]`));
      } else if (!isSingleSymbol(s)) {
        issues.push(issue('error', 'SYMBOL_NOT_SINGLE_CHAR', `Symbol ${show(s)} in ${name} must be exactly one character.`, `${name}[${i}]`));
      }
    });
    for (const d of findDuplicates(symbols)) {
      issues.push(issue('error', 'DUPLICATE_SYMBOL', `Symbol ${show(d)} appears more than once in ${name}.`, name));
    }
  };
  checkAlphabet('inputAlphabet', def.inputAlphabet);
  checkAlphabet('stackAlphabet', def.stackAlphabet);

  if (!stackAlphabet.has(def.initialStackSymbol)) {
    issues.push(
      issue(
        'error',
        'INITIAL_STACK_SYMBOL_UNKNOWN',
        `Initial stack symbol ${show(def.initialStackSymbol)} is not in the stack alphabet.`,
        'initialStackSymbol',
      ),
    );
  }

  // --- transitions ---
  const ids = new Set<string>();
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
    if (!isEpsilon(t.input) && !inputAlphabet.has(t.input)) {
      issues.push(
        issue('error', 'TRANSITION_INPUT_UNKNOWN', `Transition ${t.id}: input symbol ${show(t.input)} is not in the input alphabet (use ε to read nothing).`, `${p}.input`),
      );
    }
    if (!isEpsilon(t.stackTop) && !stackAlphabet.has(t.stackTop)) {
      issues.push(
        issue('error', 'TRANSITION_STACK_UNKNOWN', `Transition ${t.id}: stack-top symbol ${show(t.stackTop)} is not in the stack alphabet (use ε to ignore the stack).`, `${p}.stackTop`),
      );
    }
    if (!isEpsilon(t.push)) {
      for (const c of t.push) {
        if (!stackAlphabet.has(c)) {
          issues.push(
            issue('error', 'TRANSITION_PUSH_UNKNOWN', `Transition ${t.id}: pushed symbol ${show(c)} is not in the stack alphabet.`, `${p}.push`),
          );
          break;
        }
      }
    }
  });

  // --- duplicates and (non)determinism ---
  const keyOf = (t: PdaTransition) => JSON.stringify([t.from, t.input || 'ε', t.stackTop || 'ε', t.to, t.push || 'ε']);
  const seen = new Map<string, string>();
  for (const [index, t] of def.transitions.entries()) {
    const k = keyOf(t);
    const first = seen.get(k);
    if (first !== undefined) {
      issues.push(issue('error', 'DUPLICATE_TRANSITION', `Transition ${t.id} duplicates transition ${first}. Remove one of them.`, `transitions[${index}]`));
    } else {
      seen.set(k, t.id);
    }
  }

  const conflicts: string[] = [];
  const byState = new Map<string, PdaTransition[]>();
  for (const t of def.transitions) {
    const list = byState.get(t.from) ?? [];
    list.push(t);
    byState.set(t.from, list);
  }
  for (const list of byState.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a && b && keyOf(a) !== keyOf(b) && overlaps(a, b)) conflicts.push(`${a.id}/${b.id}`);
      }
    }
  }
  if (conflicts.length > 0) {
    const shown = conflicts.slice(0, 6).join(', ') + (conflicts.length > 6 ? ', …' : '');
    if (def.deterministic) {
      issues.push(
        issue(
          'error',
          'PDA_NOT_DETERMINISTIC',
          `The machine is marked deterministic but ${conflicts.length} pair(s) of transitions can apply to the same configuration: ${shown}. Remove the overlap or clear the "deterministic" flag.`,
        ),
      );
    } else {
      issues.push(
        issue(
          'info',
          'NONDETERMINISTIC',
          `The machine is nondeterministic: ${conflicts.length} pair(s) of transitions can apply to the same configuration (${shown}). All branches will be explored.`,
        ),
      );
    }
  }

  return makeValidationResult(issues);
}
