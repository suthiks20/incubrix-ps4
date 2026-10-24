# PROMPT HEADER (read before every phase)

Project: IncuBrix Assessment 4, Long-Tail Destination Network. Deadline Sun 25 Oct 2026, 11:59 PM IST.
The student must explain every line live, so keep code simple.

READ FIRST: AGENTS.md, docs/PROGRESS.md, docs/MASTER_PLAN.md, and the files named in the phase.
Docs can be wrong: verify against the code.

RULES
1. TypeScript, Node 22, CommonJS output, Fastify 5, Knex + Postgres, Jest. New files are .ts.
2. Layering: route -> handler -> service -> repository. Services throw AppError.
   Error envelope {error:{code,message,retryable,details}}. New codes go in src/shared/errors/codes.ts,
   codes.js and the README error table.
3. Every new file starts with a 2-3 line header comment. One statement per line, lines <= 110 chars,
   functions <= 40 lines.
4. No new dependencies. Write your own CSV parser, XML builder and rate limiter. If one is truly needed,
   STOP and explain.
5. No secrets in code, logs, responses, ledger, evidence, fixtures or DB rows. Test secrets are obviously fake.
6. Never post to real communities. Only local instances, mocks and CERT_ALLOWED_HOSTS.
7. Every blocked, rescheduled, warned or auto-fixed action returns code + message + what the system did.
8. Tests first or alongside. Use the exact test names the phase lists.
9. Do not commit or push. At the end print the exact git commands.
10. Update docs/PROGRESS.md (real totals, DONE/PARTIAL per item) and the AGENTS.md roadmap after the phase.

VERIFY (run all four, paste the real output)
  docker compose up --build -d
  docker compose run --rm api npm test
  docker compose run --rm api npm run lint
  docker compose run --rm api npm run build

A phase report is INVALID unless it shows: (a) full Docker totals higher than before, (b) every required test
name passing in verbose output, (c) lint and build clean. Never describe a skeleton as done.
If something cannot be finished: write exactly what remains in docs/PROGRESS.md as PARTIAL, then STOP.
Do NOT start the next phase.
Baseline before these prompts: 64 suites / 297 tests green (plus the Ghost alias test already added).