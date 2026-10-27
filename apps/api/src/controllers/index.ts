import type { RequestHandler } from 'express';
import { BUILTIN_TEST_CASES } from '@cw/core';
import type { PdaExecuteBody, TestRunBody, TmExecuteBody, ValidateBody } from '../schemas/requests';
import { getExamples } from '../services/examplesService';
import { runPda, runTm } from '../services/executionService';
import { runTests } from '../services/testService';
import { validateMachine } from '../services/validationService';

export const health: RequestHandler = (_req, res) => {
  res.json({ status: 'ok', service: 'computation-workbench-api', time: new Date().toISOString() });
};

export const examples: RequestHandler = (_req, res) => {
  res.json(getExamples());
};

export const testCases: RequestHandler = (_req, res) => {
  res.json({ cases: BUILTIN_TEST_CASES });
};

export const validate: RequestHandler = (req, res) => {
  const body = req.body as ValidateBody;
  res.json(validateMachine(body.kind, body.machine));
};

export const executePdaController: RequestHandler = (req, res) => {
  res.json(runPda(req.body as PdaExecuteBody));
};

export const executeTmController: RequestHandler = (req, res) => {
  res.json(runTm(req.body as TmExecuteBody));
};

export const runTestsController: RequestHandler = (req, res) => {
  res.json(runTests(req.body as TestRunBody));
};
