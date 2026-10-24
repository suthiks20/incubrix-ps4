# Progress

## Phase status (24 Oct 2026)

| Phase | Status | Proof and remaining work |
|---|---|---|
| 1 — Core certification, mocks, media and metrics | PARTIAL | Core connector integration tests pass. `evidence/cert-ghost-real.json` exists, but `evidence/cert-lemmy-real.json` is missing; connector metrics implementations are not present. |
| 2 — Integration Standard, first half | DONE | The six named manifest, rate-limit, OpenAPI and job-type tests pass in `tests/integration/phase2.integration.test.js`. |
| 3 — Integration Standard, second half | PARTIAL | `scripts/ix-batch.ts` and URL-input storage tests exist. The required end-to-end proof and named batch/log/config tests are not present. |
| 4 — Hidden-test readiness | NOT DONE | `src/modules/jobs/types/index.ts` still returns `JOB_TYPE_NOT_READY` for selftest; demo seeding and the selftest hard-case runner remain unimplemented. |
| 5 — Tailoring, relevance and rules capture | DONE | All eight required test names, plus supporting regression tests, pass in `tests/integration/phase5.tailoring.test.js`. |
| 6 — MRSS, Slack and Hashnode | NOT DONE | No connector implementations/manifests exist under `src/modules/connectors/` for these three platforms. |
| 7 — Catalogue import | PARTIAL | Import route/job, CSV parser, deduplication, validation, row-level error report and fixture are covered in `tests/integration/catalogue/catalogue.import.test.js`. Real Docker API import: 1,000 rows, 880 imported, 100 duplicates, 120 errors, 3.15 seconds; see `evidence/catalogue-1000-import.json`. The complete Phase 7 gate remains blocked by unfinished Phase 4 and Phase 6 work. |

## Latest repair and verification

Repaired the mock-route rate-limit exemption and test override, catalogue source schema,
JSONB insert serialization and safe error-code logging, Phase 5 POST idempotency headers,
private-URL rejection before job fetch, and the four remaining Phase 5 test failures. Catalogue
reachability uses a deterministic success check in simulation mode; it makes no external
reachability requests during mock imports.

Docker verification completed against the current API image:

```text
docker compose build api                  PASS
docker compose run --rm api npm test      Test Suites: 67 passed, 67 total
                                           Tests:       337 passed, 337 total
docker compose run --rm api npm run lint  PASS
docker compose run --rm api npm run build PASS
```

The required Phase 2 and Phase 5 test names were also run verbosely after rebuilding:
`docker compose run --rm api npm test -- --verbose tests/integration/phase2.integration.test.js tests/integration/phase5.tailoring.test.js`
reported 2 suites and 27 tests passed.

The stack was started successfully with `docker compose up --build -d`. The 1,000-row import
evidence is from the real running API, worker, Postgres and configured storage path; its
reachability component remained simulated as intended.

Infrastructure stability fix (23 Oct 2026). Fixed the SeaweedFS S3 bucket init race by retrying the bucket creation on transient connection errors and switching the MinIO healthcheck to the S3 port used by the app. This keeps `docker compose up --build -d` from failing during the `minio-init` bootstrap step when the S3 listener is still coming online. Next: validate the stack and continue the project gate.

WP4 - DONE (23 Oct 2026). Completed the Lemmy and Ghost native connectors, production-shaped simulation
mocks, registry/catalogue coverage, logger redaction, local verification alias, and Dev.to cleanup-failure
tests. Docker verified: 61 suites / 289 tests, lint clean, build clean. Next: WP2b, storage and output manifests.

WP3a - DONE (23 Oct 2026). Added the native Dev.to connector, manifest, simulation-only mock, certification
coverage, connector catalogue contract coverage, and header-based connector idempotency. Docker verified:
59 suites / 261 tests, lint clean, build clean. Next: WP2b, storage and output manifests.

WP2a - DONE (23 Oct 2026). Jobs have real-Postgres API, worker, callback, logging and HMAC-vector coverage.
Docker verified: 55 suites / 243 tests, lint clean, build clean. The local hand proof returned one idempotent
certify job with status `succeeded` and progress `100`.

P0 - DONE (22 Oct 2026). TypeScript script/bootstrap include roots, safe malformed connection JSON handling,
and simulation fallbacks are Docker-verified: 51 suites / 226 tests, lint clean, build clean.

WP1 - DONE (22 Oct 2026). Certification now includes safety preconditions, durable step evidence, immediate
and janitor cleanup, HTTP reads and summaries, Docker storage configuration, and secret-leak coverage. Docker
verified: 51 suites / 225 tests, lint clean, build clean.

WP1 Step 2 - DONE (22 Oct 2026). Certification routes now use endpoint schemas, service-level 404s, strict run
and alert filters, alert acknowledgement timestamps, and `CERT_CONFIG_INVALID`. Docker verified: 47 suites /
206 tests, lint clean, build clean.

WP1 Step 1 - DONE (22 Oct 2026). Failed certification runs make one immediate cleanup attempt, recover a
leftover post by its opaque marker, and persist either `failed` or `cleanup_pending` with `cleanup_due_at`.

WP0 Baseline - DONE (22 Oct 2026). Added the certification marker helper, immediate-cleanup helper, and local
Discourse `delete_fails_once` / `delete_fails_twice` scenarios with `delete_attempts`.

T2 shared-layer conversion and T1 TypeScript tooling are done and Docker-verified.

## Next

Complete Phase 4 selftest and Phase 6 connectors before claiming Advanced completion; then
close the remaining Phase 1, Phase 3 and Phase 7 gaps. The assessment is not complete.
