import { executePda, executeTm, getMachine } from '@cw/core';
import type { PdaDefinition, PdaExecutionResult, TmDefinition, TmExecutionResult } from '@cw/core';
import { HttpError } from '../middleware/errors';
import type { PdaExecuteBody, TmExecuteBody } from '../schemas/requests';

export type PdaResponse = { kind: 'PDA'; machineName: string } & PdaExecutionResult;
export type TmResponse = { kind: 'TM'; machineName: string } & TmExecutionResult;

function resolve<K extends 'PDA' | 'TM'>(kind: K, machine: unknown, machineId: string | undefined): K extends 'PDA' ? PdaDefinition : TmDefinition {
  if (machine !== undefined) return machine as K extends 'PDA' ? PdaDefinition : TmDefinition;
  const entry = machineId === undefined ? undefined : getMachine(machineId);
  if (!entry) throw new HttpError(404, 'MACHINE_NOT_FOUND', `No built-in machine with id '${machineId ?? ''}'.`);
  if (entry.kind !== kind) {
    throw new HttpError(400, 'MACHINE_KIND_MISMATCH', `Machine '${entry.id}' is a ${entry.kind}, not a ${kind}.`);
  }
  return entry.definition as K extends 'PDA' ? PdaDefinition : TmDefinition;
}

/** Runs the shared PDA engine. All budgets come from the validated request (ceilings enforced by the schema). */
export function runPda(body: PdaExecuteBody): PdaResponse {
  const def = resolve('PDA', body.machine, body.machineId);
  const result = executePda(def, body.input, body.options);
  return { kind: 'PDA', machineName: def.name, ...result };
}

/** Runs the shared TM engine. */
export function runTm(body: TmExecuteBody): TmResponse {
  const def = resolve('TM', body.machine, body.machineId);
  const result = executeTm(def, body.input, body.options);
  return { kind: 'TM', machineName: def.name, ...result };
}
