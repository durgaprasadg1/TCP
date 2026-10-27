import { z } from 'zod';
import {
  DEFAULT_PDA_OPTIONS,
  DEFAULT_TM_OPTIONS,
  PDA_OPTION_CEILINGS,
  TM_OPTION_CEILINGS,
  pdaDefinitionSchema,
  tmDefinitionSchema,
} from '@cw/core';

/** Explicit execution budgets: values above the ceilings are rejected, never silently clamped. */
const pdaOptions = z
  .object({
    maxConfigurations: z.number().int().min(1).max(PDA_OPTION_CEILINGS.maxConfigurations).optional(),
    maxStackSize: z.number().int().min(1).max(PDA_OPTION_CEILINGS.maxStackSize).optional(),
    maxDepth: z.number().int().min(1).max(PDA_OPTION_CEILINGS.maxDepth).optional(),
    maxTraceNodes: z.number().int().min(1).max(PDA_OPTION_CEILINGS.maxTraceNodes).optional(),
    stopOnAccept: z.boolean().optional(),
  })
  .strict()
  .default({});

const tmOptions = z
  .object({
    maxSteps: z.number().int().min(1).max(TM_OPTION_CEILINGS.maxSteps).optional(),
    maxTraceSteps: z.number().int().min(1).max(TM_OPTION_CEILINGS.maxTraceSteps).optional(),
  })
  .strict()
  .default({});

const machineId = z.string().min(1).max(100);

export const pdaExecuteSchema = z
  .object({
    machine: pdaDefinitionSchema.optional(),
    machineId: machineId.optional(),
    input: z.string().max(1000),
    options: pdaOptions,
  })
  .strict()
  .refine((b) => (b.machine === undefined) !== (b.machineId === undefined), {
    message: 'Provide exactly one of "machine" (a definition) or "machineId" (a built-in machine).',
    path: ['machine'],
  });

export const tmExecuteSchema = z
  .object({
    machine: tmDefinitionSchema.optional(),
    machineId: machineId.optional(),
    input: z.string().max(2000),
    options: tmOptions,
  })
  .strict()
  .refine((b) => (b.machine === undefined) !== (b.machineId === undefined), {
    message: 'Provide exactly one of "machine" (a definition) or "machineId" (a built-in machine).',
    path: ['machine'],
  });

/** The machine body is parsed in the controller so that malformed machines yield a 200 report, not a 400. */
export const validateSchema = z
  .object({
    kind: z.enum(['PDA', 'TM']),
    machine: z.unknown(),
  })
  .strict();

const executionStatus = z.enum(['ACCEPTED', 'REJECTED', 'INCONCLUSIVE', 'INVALID_MACHINE']);

export const testRunSchema = z
  .object({
    testIds: z.array(z.string().max(100)).max(500).optional(),
    categories: z.array(z.string().max(100)).max(50).optional(),
    custom: z
      .object({
        kind: z.enum(['PDA', 'TM']),
        machine: z.unknown(),
        cases: z
          .array(
            z
              .object({
                input: z.string().max(500),
                expected: executionStatus,
                description: z.string().max(300).optional(),
              })
              .strict(),
          )
          .min(1)
          .max(200),
        options: z
          .object({
            maxSteps: z.number().int().min(1).max(TM_OPTION_CEILINGS.maxSteps).optional(),
            maxConfigurations: z.number().int().min(1).max(PDA_OPTION_CEILINGS.maxConfigurations).optional(),
            maxStackSize: z.number().int().min(1).max(PDA_OPTION_CEILINGS.maxStackSize).optional(),
            maxDepth: z.number().int().min(1).max(PDA_OPTION_CEILINGS.maxDepth).optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const API_LIMITS = { pda: PDA_OPTION_CEILINGS, tm: TM_OPTION_CEILINGS, pdaDefaults: DEFAULT_PDA_OPTIONS, tmDefaults: DEFAULT_TM_OPTIONS };

export type PdaExecuteBody = z.infer<typeof pdaExecuteSchema>;
export type TmExecuteBody = z.infer<typeof tmExecuteSchema>;
export type ValidateBody = z.infer<typeof validateSchema>;
export type TestRunBody = z.infer<typeof testRunSchema>;
