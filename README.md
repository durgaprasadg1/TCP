# Computation Workbench

An interactive Theory of Computation laboratory. It runs **real** pushdown automata (PDA) and Turing machines (TM), shows every configuration step by step, lets you build and validate your own machines, and runs an edge-case test suite against the engines.

- **Frontend:** React, Vite, TypeScript (strict), Tailwind CSS, React Router, React Flow, Lucide
- **Backend:** Node.js, Express, TypeScript, Zod
- **Shared engines:** `packages/core` (no React, Express or browser APIs)
- **Tests:** Vitest and Supertest

The UI never decides acceptance. The Express API runs the engines from `@cw/core`; the web app displays the traces the API returns.

## Architecture

```
computation-workbench/
  packages/core/            Shared engines, types, validation, built-in machines, test suite
    src/pda/                PDA types, validator, nondeterministic engine, examples
    src/turing-machine/     TM types, validator, sparse tape, engine, examples
    src/testing/            Reusable test runner and the built-in test cases
    src/validation/         Zod schemas for machine definitions
    src/registry.ts         Built-in machines (labs) and fixtures (edge-case tests)
    tests/                  Engine unit tests
  apps/api/                 Express REST API (routes, controllers, services, schemas, middleware)
    src/tests/              Supertest integration tests
  apps/web/                 Vite + React single-page app
    src/pages/              Overview, PDA lab, TM lab, Builder, Comparison, Test runner
    src/features/           PDA and TM workspaces, machine editors
    src/components/         State diagram (React Flow), controls, shared UI
    src/lib/                API client, formatting, graph layout, localStorage persistence
```

Concerns are kept apart: machine definitions (`types.ts`), transition execution and limits (`engine.ts`), validation (`validate.ts`), trace history (the result objects), API validation (`apps/api/src/schemas`), and visualization (`apps/web`). The web app and the API import the same engines, so nothing is duplicated.

Persistence is `localStorage` (saved machines and the editor draft). The API is stateless, so a database such as MongoDB can be added later behind the services layer without touching the engines.

## Installation and setup

Requires Node.js 20 or newer.

```bash
npm install
```

### Environment variables

| Variable | Where | Default | Meaning |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | `apps/web` (see `.env.example`) | `http://localhost:4000/api` | Base URL of the API, including `/api` |
| `PORT` | API | `4000` | API port |
| `CORS_ORIGIN` | API | `http://localhost:5173`, `:4173` (localhost and 127.0.0.1) | Comma-separated allowed browser origins |
| `BODY_LIMIT` | API | `256kb` | Maximum JSON body size |

## Run commands

```bash
npm run dev          # API on :4000 and web app on :5173, together
npm run dev:api      # API only
npm run dev:web      # web app only
npm run build        # typecheck core and API, then type-check and build the web app
npm start            # API only (serve the built web app with: npm run preview -w @cw/web)
npm run typecheck    # strict TypeScript in all packages
npm run lint         # ESLint (no `any`, react-hooks rules)
```

## Test commands

```bash
npm test             # core unit tests, then API integration tests
npm run test:core
npm run test:api
```

The built-in suite (`BUILTIN_TEST_CASES`) is also run live from the **Test Runner** page through `POST /api/tests/run`.

## Algorithms and conventions

### PDA (`packages/core/src/pda`)

- A transition `(q, a, X) → (p, γ)` applies to configuration `(q, i, S)` when `a` is ε or equals `input[i]`, and `X` is ε or equals the stack top. It consumes `a`, pops `X` (unless ε) and pushes `γ`.
- `γ` is written **top first**: pushing `AZ` leaves `A` on top of `Z`. An empty (or `ε`) push pushes nothing. Replace top `X` by `Y` with push `Y`; keep `X` and add `Y` with push `YX`.
- Stacks in results are arrays ordered bottom → top. The machine starts with one `initialStackSymbol`.
- Acceptance needs all input consumed **and** either a final state (`FINAL_STATE`) or an empty stack (`EMPTY_STACK`).
- Simulation is a breadth-first worklist over configurations `(state, position, stack)`. **Every** applicable transition is followed. Each distinct configuration is expanded once, which stops ε-cycles from looping.
- Budgets: `maxConfigurations`, `maxStackSize`, `maxDepth`. If one is hit before an accepting configuration is found the result is **INCONCLUSIVE**, never REJECTED. REJECTED means exploration finished and no reachable configuration accepts.
- Input symbols outside the input alphabet are rejected up front (documented pre-check) with an explanation.
- The trace is the computation tree: nodes, per-depth levels (all configurations alive after `d` steps), the accepting path and statistics.

### Turing machine (`packages/core/src/turing-machine`)

- Deterministic, single tape, `(state, read) → (state, write, L|R|S)`. `S` (stay) is a convenience extension.
- Sparse tape (`Map` of non-blank cells), so it extends in both directions without allocation. Default model is a **two-way infinite tape**; `LEFT_BOUNDED` keeps the head on cell 0 when moving left from it. The input occupies cells `0…n−1` and the head starts on cell 0.
- Halting states: entering an accept or reject state halts immediately.
- **Missing transition:** the machine halts and **rejects** (implicit reject). The result carries `haltReason: MISSING_TRANSITION` and the stuck `(state, symbol)`, so it can be told apart from entering a reject state.
- **Step limit:** after `maxSteps` transitions without halting the result is **INCONCLUSIVE**. A halt that happens exactly on the last permitted step still counts as a halt.
- Every configuration records step number, state, head, symbol under the head, a tape window and the applied transition.

### Built-in machines

| Id | Machine |
| --- | --- |
| `pda-anbn` | aⁿbⁿ, n ≥ 1 (deterministic, final-state acceptance) |
| `pda-parentheses` | Balanced parentheses (empty-stack acceptance; ε is balanced) |
| `pda-palindrome` | Even palindromes w·wᴿ (genuinely nondeterministic) |
| `pda-anbn-cstar` | A failed single-stack attempt at aⁿbⁿcⁿ that recognizes aⁿbⁿcᵐ, used by the comparison page |
| `tm-anbn` | aⁿbⁿ by marking |
| `tm-anbncn` | aⁿbⁿcⁿ by marking: validate shape `a+b+c+` with TM transitions, then repeatedly mark one a→X, b→Y, c→Z and rewind; finally check only Y and Z remain |
| `tm-unary-increment` | 1ⁿ ↦ 1ⁿ⁺¹, to show writing and head movement |

The aⁿbⁿcⁿ machine does its work through transitions only: there is no counting shortcut or regular expression. Its step count grows roughly quadratically, which the Comparison page measures.

### Validation

`validatePda` and `validateTm` check state and symbol references, duplicate states, symbols and transitions, missing start state, alphabet consistency, conflicting transitions in the deterministic TM and overlapping transitions in a PDA declared `deterministic`. They report actionable messages and never repair the definition. The editor shows the same messages live and can ask the API to validate.

## API

All bodies are JSON. Errors have the shape `{ "error": { "code", "message", "details?" } }`. Bodies are limited to `BODY_LIMIT`; unknown keys are rejected. Budgets above the ceilings are rejected with `400` rather than clamped.

| Method and path | Purpose |
| --- | --- |
| `GET /api/health` | Liveness check |
| `GET /api/examples` | Built-in machines (definitions, sample inputs), test categories, budget limits |
| `GET /api/tests/cases` | The built-in test cases |
| `POST /api/machines/validate` | `{ kind: "PDA"\|"TM", machine }` → `{ valid, issues[], summary }` |
| `POST /api/pda/execute` | `{ machine \| machineId, input, options? }` → status, reason, final configuration, computation tree, accepting path, statistics |
| `POST /api/tm/execute` | `{ machine \| machineId, input, options? }` → status, halt reason, configurations (trace), steps, final tape content |
| `POST /api/tests/run` | `{ testIds?, categories?, custom?: { kind, machine, cases[], options? } }` → results and summary |

Execution `status` is one of `ACCEPTED`, `REJECTED`, `INCONCLUSIVE`, `INVALID_MACHINE`. A malformed machine body gives `400`; a well-formed but semantically invalid machine gives `200` with `INVALID_MACHINE` and the issue list.

Options. PDA: `maxConfigurations` (≤ 50 000), `maxStackSize` (≤ 500), `maxDepth` (≤ 20 000), `maxTraceNodes`, `stopOnAccept`. TM: `maxSteps` (≤ 200 000), `maxTraceSteps`.

Security: the API only parses JSON, validates with Zod and calls pure functions. It touches no files and evaluates no user-supplied code. The complete trace is returned in one response; the services layer is the natural place to add streaming later.

## Theoretical limitations

- A finite simulation can never prove that an arbitrary Turing machine does not halt. INCONCLUSIVE means only "not decided within the budget".
- The halting problem for TMs is undecidable. Acceptance for PDAs is decidable in principle, but this simulator explores configurations directly, so a PDA that pushes forever on ε-moves can also be INCONCLUSIVE within its budget.
- Languages versus machines: "aⁿbⁿcⁿ has no PDA" is a statement about the language (it is not context-free), not about any one machine's behavior. A TM is not faster than a PDA on every input; for aⁿbⁿ the PDA is linear while the marking TM is quadratic.
- Results about one machine (step counts, traces) do not generalize to all machines.
- The `stay` move and the two-way infinite tape are conveniences; both are equivalent in power to the standard one-way models.


## New machine examples and visual theme

- **PDA: `w c wᴿ`** — available in the PDA Laboratory and Machine Builder templates. It pushes the prefix before `c`, then matches the suffix in reverse by popping the stack. Try `abcba` (accepted) and `abca` (rejected).
- **TM: `aⁿbⁿ` explicit rejection** — when the machine has marked an `a` but reaches a blank before finding a matching `b`, it now enters the named `reject` state. The state diagram highlights the active reject state in red. Try `aab`.
- The interface uses the requested `#EBE2CC`, `#DED6C1`, `#CFC6B1`, and `#B7B09E` palette, with dark text and labels on light backgrounds.

To build and run locally, use Node.js 20 or newer: `npm ci`, then `npm run dev`.
