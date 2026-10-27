import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  BUILTIN_TEST_CASES,
  PDA_ANBN,
  PDA_INVALID_START,
  PDA_PALINDROME,
  PDA_RUNAWAY,
  TM_ANBNCN,
  TM_CONFLICTING,
  TM_INFINITE_LOOP,
  TM_UNARY_INCREMENT,
} from '@cw/core';
import { createApp } from '../app';
import { loadConfig } from '../config';

const app = createApp(loadConfig({ CORS_ORIGIN: 'http://localhost:5173' }));

describe('GET /api/health', () => {
  it('reports ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /api/examples', () => {
  it('lists the built-in machines with definitions and sample inputs', async () => {
    const res = await request(app).get('/api/examples');
    expect(res.status).toBe(200);
    const ids = (res.body.machines as { id: string }[]).map((m) => m.id);
    expect(ids).toEqual(['pda-anbn', 'pda-parentheses', 'pda-palindrome', 'pda-anbn-cstar', 'tm-anbn', 'tm-anbncn', 'tm-unary-increment']);
    const anbn = res.body.machines[0];
    expect(anbn.definition.transitions.length).toBeGreaterThan(0);
    expect(anbn.sampleAccepted).toContain('aabb');
    expect(res.body.limits.pda.maxConfigurations).toBeGreaterThan(0);
  });
});

describe('POST /api/pda/execute', () => {
  it('runs a built-in machine by id and returns the real trace', async () => {
    const res = await request(app).post('/api/pda/execute').send({ machineId: 'pda-anbn', input: 'aabb' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ kind: 'PDA', status: 'ACCEPTED', steps: 5, acceptedBy: 'FINAL_STATE' });
    expect(res.body.acceptingPath).toHaveLength(6);
    expect(res.body.finalConfiguration).toMatchObject({ state: 'q2', position: 4, stack: ['Z'] });
  });

  it('runs a machine definition sent in the request', async () => {
    const res = await request(app).post('/api/pda/execute').send({ machine: PDA_PALINDROME, input: 'abba' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACCEPTED');
    expect(res.body.stats.maxSimultaneous).toBeGreaterThan(1);
  });

  it('rejects words outside the language', async () => {
    const res = await request(app).post('/api/pda/execute').send({ machine: PDA_ANBN, input: 'aab' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('REJECTED');
  });

  it('returns INCONCLUSIVE (not REJECTED) when the explicit budget is exhausted', async () => {
    const res = await request(app)
      .post('/api/pda/execute')
      .send({ machine: PDA_RUNAWAY, input: 'a', options: { maxConfigurations: 40 } });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('INCONCLUSIVE');
    expect(res.body.stats.limitHit).toBe('maxConfigurations');
  });

  it('reports INVALID_MACHINE with actionable issues', async () => {
    const res = await request(app).post('/api/pda/execute').send({ machine: PDA_INVALID_START, input: 'a' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('INVALID_MACHINE');
    expect(res.body.issues.map((i: { code: string }) => i.code)).toContain('START_STATE_UNKNOWN');
  });

  it('answers 400 for a missing input', async () => {
    const res = await request(app).post('/api/pda/execute').send({ machineId: 'pda-anbn' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('answers 400 when both or neither of machine and machineId are given', async () => {
    const both = await request(app).post('/api/pda/execute').send({ machine: PDA_ANBN, machineId: 'pda-anbn', input: '' });
    const neither = await request(app).post('/api/pda/execute').send({ input: '' });
    expect(both.status).toBe(400);
    expect(neither.status).toBe(400);
  });

  it('refuses budgets above the server ceiling instead of clamping silently', async () => {
    const res = await request(app)
      .post('/api/pda/execute')
      .send({ machineId: 'pda-anbn', input: 'ab', options: { maxConfigurations: 99_999_999 } });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('options.maxConfigurations');
  });

  it('rejects unknown keys such as script fields', async () => {
    const res = await request(app).post('/api/pda/execute').send({ machineId: 'pda-anbn', input: 'ab', code: 'process.exit()' });
    expect(res.status).toBe(400);
  });

  it('answers 404 for an unknown built-in machine and 400 for the wrong kind', async () => {
    const missing = await request(app).post('/api/pda/execute').send({ machineId: 'nope', input: '' });
    const wrong = await request(app).post('/api/pda/execute').send({ machineId: 'tm-anbncn', input: '' });
    expect(missing.status).toBe(404);
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe('MACHINE_KIND_MISMATCH');
  });

  it('fills in missing transition ids', async () => {
    const noIds = { ...PDA_ANBN, transitions: PDA_ANBN.transitions.map(({ id: _id, ...rest }) => rest) };
    const res = await request(app).post('/api/pda/execute').send({ machine: noIds, input: 'ab' });
    expect(res.body.status).toBe('ACCEPTED');
    expect(res.body.nodes.at(-1).transitionId).toBe('t5');
  });
});

describe('POST /api/tm/execute', () => {
  it('accepts a^n b^n c^n through real tape transitions', async () => {
    const res = await request(app).post('/api/tm/execute').send({ machineId: 'tm-anbncn', input: 'aabbcc' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ kind: 'TM', status: 'ACCEPTED', haltReason: 'ACCEPT_STATE', finalTapeContent: 'XXYYZZ' });
    expect(res.body.steps).toBeGreaterThan(20);
    expect(res.body.configurations[0]).toMatchObject({ step: 0, state: 'start', head: 0 });
  });

  it('rejects unequal counts', async () => {
    const res = await request(app).post('/api/tm/execute').send({ machine: TM_ANBNCN, input: 'aabbccc' });
    expect(res.body.status).toBe('REJECTED');
  });

  it('computes the unary successor', async () => {
    const res = await request(app).post('/api/tm/execute').send({ machine: TM_UNARY_INCREMENT, input: '111' });
    expect(res.body.status).toBe('ACCEPTED');
    expect(res.body.finalTapeContent).toBe('1111');
  });

  it('returns INCONCLUSIVE when the step limit is hit', async () => {
    const res = await request(app).post('/api/tm/execute').send({ machine: TM_INFINITE_LOOP, input: 'a', options: { maxSteps: 250 } });
    expect(res.body.status).toBe('INCONCLUSIVE');
    expect(res.body.haltReason).toBe('STEP_LIMIT');
    expect(res.body.steps).toBe(250);
  });

  it('reports a missing transition as REJECTED with the stuck pair', async () => {
    const res = await request(app).post('/api/tm/execute').send({ machine: TM_ANBNCN, input: 'aabcc' });
    expect(res.body.haltReason).toBe('MISSING_TRANSITION');
    expect(res.body.missingTransition).toEqual({ state: 'seekB', symbol: 'Z' });
  });

  it('reports conflicting transitions as INVALID_MACHINE', async () => {
    const res = await request(app).post('/api/tm/execute').send({ machine: TM_CONFLICTING, input: 'a' });
    expect(res.body.status).toBe('INVALID_MACHINE');
    expect(res.body.issues.map((i: { code: string }) => i.code)).toContain('CONFLICTING_TRANSITIONS');
  });

  it('refuses step limits above the ceiling', async () => {
    const res = await request(app).post('/api/tm/execute').send({ machineId: 'tm-anbncn', input: 'abc', options: { maxSteps: 10_000_000 } });
    expect(res.status).toBe(400);
  });

  it('answers 400 for a malformed machine', async () => {
    const res = await request(app).post('/api/tm/execute').send({ machine: { states: 'q0' }, input: '' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/machines/validate', () => {
  it('confirms a valid machine', async () => {
    const res = await request(app).post('/api/machines/validate').send({ kind: 'TM', machine: TM_ANBNCN });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ kind: 'TM', valid: true, summary: { states: 11 } });
  });

  it('lists every problem of an invalid machine', async () => {
    const res = await request(app).post('/api/machines/validate').send({ kind: 'PDA', machine: PDA_INVALID_START });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.issues.some((i: { code: string; path: string }) => i.code === 'START_STATE_UNKNOWN' && i.path === 'startState')).toBe(true);
  });

  it('reports structural problems as a normal invalid answer', async () => {
    const res = await request(app).post('/api/machines/validate').send({ kind: 'PDA', machine: { name: 5 } });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.issues[0].code).toBe('MALFORMED_DEFINITION');
  });

  it('answers 400 without a kind', async () => {
    const res = await request(app).post('/api/machines/validate').send({ machine: PDA_ANBN });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/tests/run', () => {
  it('runs every built-in case through the engines and all pass', async () => {
    const res = await request(app).post('/api/tests/run').send({});
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ total: BUILTIN_TEST_CASES.length, passed: BUILTIN_TEST_CASES.length, failed: 0, inconclusive: 0 });
    expect(res.body.results[0]).toHaveProperty('actual');
    expect(res.body.results[0]).toHaveProperty('explanation');
  });

  it('filters by category', async () => {
    const res = await request(app).post('/api/tests/run').send({ categories: ['Missing TM transitions'] });
    expect(res.body.summary.total).toBe(3);
    expect(res.body.results.every((r: { category: string }) => r.category === 'Missing TM transitions')).toBe(true);
  });

  it('reports failures honestly for a custom machine with a wrong expectation', async () => {
    const res = await request(app)
      .post('/api/tests/run')
      .send({
        custom: {
          kind: 'PDA',
          machine: PDA_ANBN,
          cases: [
            { input: 'aabb', expected: 'ACCEPTED' },
            { input: 'aabb', expected: 'REJECTED' },
            { input: 'aaaabbbb', expected: 'ACCEPTED' },
          ],
          options: { maxConfigurations: 3 },
        },
      });
    expect(res.status).toBe(200);
    // with a 3-configuration budget: "aabb" cannot even be decided
    expect(res.body.summary.passed).toBe(0);
    expect(res.body.summary.inconclusive).toBe(3);
  });

  it('distinguishes FAIL from PASS for a custom machine', async () => {
    const res = await request(app)
      .post('/api/tests/run')
      .send({ custom: { kind: 'TM', machine: TM_ANBNCN, cases: [{ input: 'abc', expected: 'ACCEPTED' }, { input: 'abc', expected: 'REJECTED' }] } });
    expect(res.body.summary).toMatchObject({ total: 2, passed: 1, failed: 1 });
  });

  it('answers 400 for a malformed custom machine', async () => {
    const res = await request(app)
      .post('/api/tests/run')
      .send({ custom: { kind: 'PDA', machine: { nope: true }, cases: [{ input: '', expected: 'ACCEPTED' }] } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MALFORMED_MACHINE');
  });
});

describe('Cross-cutting behaviour', () => {
  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nothing');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 INVALID_JSON for broken JSON', async () => {
    const res = await request(app).post('/api/pda/execute').set('Content-Type', 'application/json').send('{"machineId": ');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('returns 413 for oversized bodies', async () => {
    const res = await request(app)
      .post('/api/pda/execute')
      .send({ machineId: 'pda-anbn', input: 'a'.repeat(400_000) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('answers 400 for over-long inputs within the body limit', async () => {
    const res = await request(app).post('/api/pda/execute').send({ machineId: 'pda-anbn', input: 'a'.repeat(5000) });
    expect(res.status).toBe(400);
  });

  it('allows the configured CORS origin and withholds the header from others', async () => {
    const ok = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    const bad = await request(app).get('/api/health').set('Origin', 'http://evil.example');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers CORS preflight requests', async () => {
    const res = await request(app)
      .options('/api/pda/execute')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });

  it('does not advertise the framework', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
