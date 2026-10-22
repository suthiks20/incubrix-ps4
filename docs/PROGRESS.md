# Progress

## Current step

WP0 Baseline — DONE (22 Oct 2026). Docker verified: 44 suites / 187 tests, lint clean, build clean.
Added the missing certification overlay: stable marker helper, one-attempt immediate-cleanup helper, and local
Discourse `delete_fails_once` / `delete_fails_twice` scenarios with `delete_attempts`. The helper is deliberately
not yet wired into run persistence; that integration, cleanup_pending, janitor, routes and summary are WP1.

Next: WP1 Finish certification, section C step 1 — integrate immediate cleanup after failure, marker recovery,
cleanup_pending and cleanup_due_at with tests first. Do not start later WP1 sections until that step is green.

T2 shared-layer conversion is done and Docker-verified. Config, database bootstrap, shared infrastructure,
the application factory and server entry point now compile from TypeScript; 41 suites / 182 tests and lint pass.

T1 TypeScript tooling is done and Docker-verified. JavaScript source remains unchanged; the build emits
CommonJS to `dist/src` and copies connector YAML manifests so the compiled server can load them at runtime.
The container command is `node dist/src/server.js`; Docker tests passed 41 suites / 182 tests and lint passed.

Certification Block A, steps S1 to S4 (partial) are done and verified against a real Postgres 16.
Docker totals to confirm on your machine: Test Suites: 41 passed, Tests: 182 passed; lint clean.

Done: config hygiene, pure certification building blocks, repository/handler layout, the certification
orchestrator (run.js, platformSteps.js, outcome.js), passing path for Discourse, webhook and assisted,
failed runs record every step (later steps skipped), demotion, one alert, recertification.

## Next

S3c: remaining certify tests (non-sandbox host, no frequency-cap count, idempotent retry,
recertification keeps level, stored steps). S4: unavailable platform, expired token, missing base_url,
disabled connector. S5: immediate cleanup and cleanup_pending. S6: HTTP schemas, 404s, alerts tests.
S7: janitor, summary, secrets test. Then docs (A3).
