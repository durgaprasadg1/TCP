import { EPSILON } from '@cw/core';
import type { PdaConfiguration, PdaTransition, TmAppliedTransition, TmTransition } from '@cw/core';

/** Show the empty string as ε. */
export const sym = (s: string): string => (s === '' ? EPSILON : s);

export function pdaTransitionText(t: PdaTransition): string {
  return `${sym(t.input)}, ${sym(t.stackTop)} → ${sym(t.push)}`;
}

export function pdaTransitionFull(t: PdaTransition): string {
  return `δ(${t.from}, ${sym(t.input)}, ${sym(t.stackTop)}) ∋ (${t.to}, ${sym(t.push)})`;
}

export function tmTransitionText(t: Pick<TmTransition, 'read' | 'write' | 'move'>): string {
  return `${t.read} → ${t.write}, ${t.move}`;
}

export function tmTransitionFull(t: TmAppliedTransition | TmTransition): string {
  return `δ(${t.from}, ${t.read}) = (${t.to}, ${t.write}, ${t.move})`;
}

export function stackText(stack: string[]): string {
  return stack.length === 0 ? '∅' : stack.join(' ');
}

/** (state, remaining input, stack with the top on the left) */
export function pdaConfigText(c: PdaConfiguration, input: string): string {
  const rest = Array.from(input).slice(c.position).join('');
  const top = [...c.stack].reverse().join('');
  return `(${c.state}, ${rest === '' ? EPSILON : rest}, ${top === '' ? EPSILON : top})`;
}

export const MOVE_LABEL: Record<string, string> = { L: 'Left', R: 'Right', S: 'Stay' };
export const MOVE_ARROW: Record<string, string> = { L: '←', R: '→', S: '•' };
