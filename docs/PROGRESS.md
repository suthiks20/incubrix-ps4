# Progress

## Phase status (24 Oct 2026)

| Phase | Status | Proof and remaining work |
|---|---|---|
| 1 — Core certification, mocks, media and metrics | DONE | Lemmy and Ghost passed real API certification at L3; secret-free evidence is in `evidence/cert-lemmy-real.json` and `evidence/cert-ghost-real.json`, including direct deletion checks. All mock fault scenarios are available, all connector manifests define media MIME types, media violations identify the field/reason/allowed types, and Discourse, Dev.to, and Ghost return normalized metrics. |
| 2 — Integration Standard, first half | DONE | The six named manifest, rate-limit, OpenAPI and job-type tests pass in `tests/integration/phase2.integration.test.js`. |
| 3 — Integration Standard, second half | PARTIAL | Assisted error envelopes, batch CLI output/auth, end-to-end flow, config parity, structured job logs, and ten proof rows are verified. The eight batch sample scenarios are labeled, but `batch_publish` remains `JOB_TYPE_NOT_READY`; see `docs/INTEGRATION_PROOF.md`. Docker gate: 70 suites / 357 tests; lint and build clean. |
| 4 — Hidden-test readiness | DONE | `SEED_DEMO` startup and `npm run seed` create 17 idempotent mock-only destinations. `/api/v1/selftest` runs all 14 scenarios (or one reviewer-selected case), stores the report and links the report and manifest. All cases pass, test posts are cleaned, and certification demotion is restored. Verified in `tests/integration/phase4.selftest.test.js`. |
| 5 — Tailoring, relevance and rules capture | DONE | All eight required test names, plus supporting regression tests, pass in `tests/integration/phase5.tailoring.test.js`. |
| 6 — MRSS, Slack and Hashnode | NOT DONE | No connector implementations/manifests exist under `src/modules/connectors/` for these three platforms. |
| 7 — Catalogue import | PARTIAL | Import route/job, CSV parser, deduplication, validation, row-level error report and fixture are covered in `tests/integration/catalogue/catalogue.import.test.js`. Latest Docker API import evidence: 1,000 rows, 880 imported, 100 duplicates, 120 errors, 2.517 seconds; see `evidence/catalogue-1000-import.json`. Overall advanced-item closure remains blocked by unfinished Phase 6. |

## Latest repair and verification

### Phase 4 hidden-test readiness (24 Oct 2026)

Added the idempotent `npm run seed` command and `SEED_DEMO` startup seeding. The seed inserts 17
mock-only destination rows, including every required fault scenario and a healthy destination for
each of the six core connectors. JSONB fields are serialized before writes; the seed leaves
certification-owned destination fields to the certification module. Seeded simulation destinations
resolve only fake simulation credentials, even if a platform connection file exists.

Replaced the selftest not-ready handler with a queued job and `POST /api/v1/selftest`. The complete
run checks timeout reconciliation, reset-aware 429 retry, expired credentials, rejected content,
title/body/media limits, frequency caps, promotion rules, certification schema drift and cleanup,
revoked partner permission, language policy, AI disclosure, and real catalogue import behavior.
The job stores a JSON report and output manifest and exposes both download links. Posts created by
the mock checks are deleted; the certification case restores its previous destination certification
state. The README reviewer guide provides a one-command-per-case workflow.

Docker verification:

```text
docker compose up --build -d                  PASS
docker compose run --rm api npm test          Test Suites: 71 passed, 71 total
                                              Tests:       367 passed, 367 total
docker compose run --rm api npm run lint      PASS
docker compose run --rm api npm run build     PASS
```

All five required Phase 4 tests and `openapi.yaml matches the registered routes exactly` passed
in verbose output. Startup seeding with `SEED_DEMO=true` was verified to produce 17 destination
rows. `npm run seed` completed successfully. The seed and selftest tests also confirm no stale
posts, idempotent job submission, per-case expected/actual codes, and destination-state restoration.

### Phase 3 Integration Standard, second half (24 Oct 2026)

Implemented shared error-envelope coverage for assisted unsupported methods; added optional bearer-token
support to `ix-batch`, deterministic per-input result files (including submission failures), manifest
downloads, and folder/single-file input coverage. Added eight named sample inputs for the requested
hard-case labels. The sample job type `batch_publish` is still intentionally not ready, so the labels are
fixtures rather than live platform scenario executions; Integration Standard point 10 remains PARTIAL.

Completed the no-platform-key end-to-end flow through destination creation, mock publish/status/delete,
certification job polling, and manifest download. The config parity test confirms all 41 typed settings
are listed in `.env.example`. Job log coverage parses structured JSON and verifies `job_id` and
`correlation_id`. Ten point-by-point Integration Standard rows are in `docs/INTEGRATION_PROOF.md`.

Docker verification:

```text
docker compose up --build -d                  PASS
docker compose build api                      PASS
docker compose run --rm api npm test          Test Suites: 70 passed, 70 total
                                              Tests:       357 passed, 357 total
docker compose run --rm api npm run lint      PASS
docker compose run --rm api npm run build     PASS
```

`npm run ix-batch -- --input samples/batch --out /tmp/ix-batch-phase3 --api http://api:8000`
ran inside the Docker image and discovered all eight samples. All eight jobs reached terminal failure
with `JOB_TYPE_NOT_READY`, as expected from the current `batch_publish` handler. Focused verbose runs
passed the required assisted, batch, end-to-end, config, job-log, and OpenAPI parity test names.
Phase 3 remains PARTIAL until those sample cases execute real platform scenarios.

### Phase 1 real local certification (24 Oct 2026)

The default stack starts Lemmy, Ghost and their dependencies with no local-instances profile.
The one-shot bootstrap completed on a clean volume, created the local accounts, and stored
connection data in the private shared volume. The API readiness endpoint returned `ready`
with both database and storage checks `ok`. The API reads the optional `CONNECTIONS_FILE`
below per-connection environment overrides.

`docker compose run --rm api npm run certify:real` certified both local destinations through
the API. Both runs passed at L3 with `validate`, `publish`, `confirm_live`, `read_status`,
`delete` and `verify_gone` passed. Direct GET checks confirmed Lemmy returned a removed post
and Ghost returned 404. The evidence files contain no connection values. The exact evidence
test, `real certification evidence files show passed at L3`, passed in the full suite.

The first certification attempt failed at Lemmy `publish` with `CONNECTION_AUTH_EXPIRED`:
the existing local per-connection environment override took precedence over the newly
bootstrapped file. The API and certification runner were rerun with empty per-connection
overrides, allowing the shared file to supply the fresh credentials; both certifications
then passed. The ignored `.env` was not read or changed.

Docker verification after the clean start:

```text
docker compose up --build -d            PASS; API, Postgres, storage, Lemmy, Ghost and bootstrap started
docker compose run --rm api npm test    Test Suites: 68 passed, 68 total
                                         Tests:       340 passed, 340 total
docker compose run --rm api npm run lint PASS
docker compose run --rm api npm run build PASS
```

The resolver unit tests use isolated temporary connection files so a real certification
volume cannot affect expectations; empty per-connection environment variables now fall
through to stored file credentials. Connector mock parity, media rejection and overrides,
normalized metrics, and manifest/method capability parity are covered in
`tests/integration/phase1.remainder.test.js`. Discourse, Dev.to, and Ghost implement
`fetch_metrics`; other connectors retain the shared unsupported response. The OpenAPI route
parity test also passes.

Final Phase 1 Docker verification:

```text
docker compose up --build -d             PASS; default stack and bootstrap started
docker compose run --rm api npm test     Test Suites: 69 passed, 69 total
                                          Tests:       351 passed, 351 total
docker compose run --rm api npm run lint PASS
docker compose run --rm api npm run build PASS
```

The exact Phase 1 test names and `openapi.yaml matches the registered routes exactly` passed
in verbose runs. Phase 1 items 1.1–1.5 are verified. The other project phases remain in their
existing PARTIAL/NOT DONE states.

Repaired the mock-route rate-limit exemption and test override, catalogue source schema,
JSONB insert serialization and safe error-code logging, Phase 5 POST idempotency headers,
private-URL rejection before job fetch, and the four remaining Phase 5 test failures. Catalogue
reachability uses a deterministic success check in simulation mode; it makes no external
reachability requests during mock imports.

Earlier Docker verification completed against the API image at that point:

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

The stack was started successfully with `docker compose up --build -d`. The latest 1,000-row
import evidence is from the full integration import test and is recorded in
`evidence/catalogue-1000-import.json`; its reachability component remained simulated as intended.

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
