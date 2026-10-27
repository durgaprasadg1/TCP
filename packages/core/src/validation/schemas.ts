import { z } from 'zod';
import type { ValidationIssue } from '../shared-types';
import type { PdaDefinition } from '../pda/types';
import type { TmDefinition } from '../turing-machine/types';

/**
 * Structural (shape and size) validation with Zod. Semantic checks (state references, determinism, ...)
 * live in validatePda / validateTm so the editor can show them for half-finished machines as well.
 * Schemas are strict: unknown keys are errors rather than being dropped silently.
 */

const stateName = z.string().max(64);
const symbol = z.string().max(8);
const description = z.string().max(2000).optional();
const machineName = z.string().max(120);

const pdaTransitionSchema = z
  .object({
    id: z.string().max(64).optional(),
    from: stateName,
    input: symbol,
    stackTop: symbol,
    to: stateName,
    push: z.string().max(64),
  })
  .strict();

export const pdaDefinitionSchema: z.ZodType<PdaDefinition, z.ZodTypeDef, unknown> = z
  .object({
    kind: z.literal('PDA').default('PDA'),
    name: machineName.default('Custom PDA'),
    description,
    states: z.array(stateName).max(200),
    inputAlphabet: z.array(symbol).max(100),
    stackAlphabet: z.array(symbol).max(100),
    startState: stateName,
    initialStackSymbol: symbol,
    finalStates: z.array(stateName).max(200),
    acceptanceMode: z.enum(['FINAL_STATE', 'EMPTY_STACK']),
    deterministic: z.boolean().optional(),
    transitions: z.array(pdaTransitionSchema).max(2000),
  })
  .strict()
  .transform((d): PdaDefinition => ({
    ...d,
    transitions: d.transitions.map((t, i) => ({ ...t, id: t.id ?? `t${i + 1}` })),
  }));

const tmTransitionSchema = z
  .object({
    id: z.string().max(64).optional(),
    from: stateName,
    read: symbol,
    to: stateName,
    write: symbol,
    move: z.string().max(8),
  })
  .strict();

export const tmDefinitionSchema: z.ZodType<TmDefinition, z.ZodTypeDef, unknown> = z
  .object({
    kind: z.literal('TM').default('TM'),
    name: machineName.default('Custom TM'),
    description,
    states: z.array(stateName).max(200),
    inputAlphabet: z.array(symbol).max(100),
    tapeAlphabet: z.array(symbol).max(100),
    blank: symbol,
    startState: stateName,
    acceptStates: z.array(stateName).max(200),
    rejectStates: z.array(stateName).max(200),
    tapeModel: z.enum(['TWO_WAY_INFINITE', 'LEFT_BOUNDED']).optional(),
    transitions: z.array(tmTransitionSchema).max(2000),
  })
  .strict()
  .transform((d): TmDefinition => ({
    ...d,
    // `move` is validated semantically (L, R or S) so the editor can report a precise message.
    transitions: d.transitions.map((t, i) => ({ ...t, id: t.id ?? `t${i + 1}`, move: t.move as TmDefinition['transitions'][number]['move'] })),
  }));

export function zodIssuesToValidation(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((i) => ({
    severity: 'error' as const,
    code: 'MALFORMED_DEFINITION',
    message: `${i.path.length > 0 ? i.path.join('.') + ': ' : ''}${i.message}`,
    path: i.path.join('.'),
  }));
}

export type ParseResult<T> = { success: true; data: T } | { success: false; issues: ValidationIssue[] };

export function parsePdaDefinition(value: unknown): ParseResult<PdaDefinition> {
  const r = pdaDefinitionSchema.safeParse(value);
  return r.success ? { success: true, data: r.data } : { success: false, issues: zodIssuesToValidation(r.error) };
}

export function parseTmDefinition(value: unknown): ParseResult<TmDefinition> {
  const r = tmDefinitionSchema.safeParse(value);
  return r.success ? { success: true, data: r.data } : { success: false, issues: zodIssuesToValidation(r.error) };
}
