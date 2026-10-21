# Progress

## Current step

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
