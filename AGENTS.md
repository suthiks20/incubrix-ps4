---
# IncuBrix Long-Tail Destination Network: agent instructions
Candidate submission for IncuBrix Assessment 4 ("Distribution: Long-Tail Destination Network"). Deadline Sun 25 Oct 2026 11:59 PM IST. The student must explain every line live: keep code simple.
## Rules
- TypeScript, Node 22, CommonJS output, strict off for now, Fastify 5, Knex + Postgres, Jest, Docker Compose. No new dependencies without stopping to explain.
- Route -> handler -> service -> repository. Services throw AppError. Error envelope {error:{code,message,retryable,details}}; codes live in src/shared/errors/codes.ts and are listed in README.md.
- Small single-purpose files; 2-3 line header comment on every new file.
- No secrets in code, logs, responses, ledger, evidence, fixtures or DB rows. Test secrets are obviously fake. The logger redacts connection fields.
- Never post to real communities. Certification and tests only use local instances and mocks (CERT_ALLOWED_HOSTS or config.sandbox).
- Verify in Docker: docker compose up --build -d; docker compose run --rm api npm test; docker compose run --rm api npm run lint. Report real output. Never stop with the suite red. Do not commit or push. Update docs/PROGRESS.md after every step.
## Design facts
- One connector serves many destinations (a destination is a catalogue row). Connectors live at POST /connector/v1/{key}/{method}; manifests follow brief Appendix A exactly.
- Rules engine src/modules/rules/engine.js is pure. Decision priority: block > assist > reschedule > allow. A published key retried under a cap must replay (200 + Idempotent-Replay: true). Cap history excludes the current key and counts published, in_flight and unknown rows.
- Idempotency: /api/v1 POSTs use the Idempotency-Key header; /connector/v1 publish uses the publish ledger (marker-based reconciliation after timeouts). The per-destination publish lock is in-process only (production fix: Postgres advisory lock).
- Only the certification module writes destinations.level, last_certified_at and demoted.
- Mocks (Discourse, webhook) mount only when SIMULATION_MODE is true and have fault scenarios. The webhook test secret is "test-signing-secret".
- Tests: npm test runs Jest --runInBand against a real Postgres test database. Test cleanup must TRUNCATE ... CASCADE because destinations is referenced by foreign keys.
## Roadmap (update as you go)
The work-package order and source of truth are in docs/MASTER_PLAN.md. WP4 connector completion is done
(61 suites, 289 tests). Next: WP2b, storage and output manifests.
---
