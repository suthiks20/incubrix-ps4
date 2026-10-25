# Progress

## Phase status (25 Oct 2026)

| Phase | Status | Proof and remaining work |
|---|---|---|
| 1 — Core certification, mocks, media and metrics | DONE | Items 1.1-1.5 are verified below; real Lemmy and Ghost records are in `evidence/cert-lemmy-real.json` and `evidence/cert-ghost-real.json`. |
| 2 — Integration Standard, first half | DONE | Integration Standard points 1-10 are evidenced in `docs/INTEGRATION_PROOF.md`. |
| 3 — Integration Standard, second half | DONE | All eight seeded simulation inputs match their expected outcome; batch cleanup and report/manifest links pass in `tests/integration/phase3.second-half.test.js`. |
| 4 — Hidden-test readiness | DONE | Seed and all 14 mock-only selftest cases are verified in `tests/integration/phase4.selftest.test.js`. |
| 5 — Tailoring, relevance and rules capture | DONE | Items 5.1-5.3 and their required tests pass in `tests/integration/phase5.tailoring.test.js`. |
| 6 — MRSS, Slack and Hashnode | DONE | All three Advanced connectors pass mock certification and contract coverage; see the Phase 6b gate below. |
| 7 — Catalogue import | DONE | Import, row errors, mixed languages, real selftest importer scenario, and the protected 1,000-row record are proved by `tests/integration/catalogue/catalogue.import.test.js`, `tests/integration/phase4.selftest.test.js`, and `evidence/catalogue-1000-import.json` (2.626 seconds). |
| 8 — Measurement and submission pack | PARTIAL | Metrics, sources, AI-use disclosure, 22.7-second cold-start result, and unedited demo video are recorded. Remaining items: Submission Form entry, reviewer repository access, and certification screenshots for Discourse, Dev.to, webhook, and assisted. |

## Brief-item reconciliation

| Item | Status | Proof |
|---|---|---|
| 1.1 Connection delivery from file and environment | DONE | `tests/unit/resolveConnection.test.js`; `.env.example` |
| 1.2 Default Docker stack and bootstrap | DONE | `docker-compose.yml`; no-`.env` startup, `/ready`, and bootstrap output in `test-pack/logs/clean-clone-up.txt` |
| 1.3 Real Lemmy/Ghost certification | DONE | `evidence/cert-lemmy-real.json`; `evidence/cert-ghost-real.json` |
| 1.4 Mock parity and media validation | DONE | `tests/integration/phase1.remainder.test.js`; connector-specific mock tests |
| 1.5 Normalized metrics | DONE | `tests/integration/phase1.remainder.test.js` fetch_metrics tests |
| Integration points 1-9 | DONE | `docs/INTEGRATION_PROOF.md` rows 1-9 |
| Integration point 10 batch runner | DONE | `batch_publish returns the expected outcome for each sample input`, `ix-batch eight sample inputs each match their expected outcome`, and `batch_publish leaves no test posts behind` in `tests/integration/phase3.second-half.test.js` |
| 3.0 Assisted unsupported-method errors | DONE | `tests/integration/phase3.second-half.test.js` |
| 3.1 Batch CLI results and samples | DONE | Eight seeded simulation sample cases match expected outcomes; tests are in `tests/integration/phase3.second-half.test.js` |
| 3.2 End-to-end path | DONE | `tests/integration/phase3.second-half.test.js` test `E2E full path with no API keys` |
| 3.3 Config parity | DONE | `tests/integration/phase3.second-half.test.js` test `.env.example lists every config setting` |
| 3.4 Job log identifiers | DONE | `tests/integration/phase3.second-half.test.js` test `job log lines carry job_id and correlation_id` |
| 3.5 Integration proof document | DONE | `docs/INTEGRATION_PROOF.md` |
| 4.1 Idempotent mock seed | DONE | `tests/integration/phase4.selftest.test.js` test `seed is idempotent` |
| 4.2 Full selftest job | DONE | `tests/integration/phase4.selftest.test.js`; selftest report/manifest links |
| 4.3 Reviewer hard-case guide | DONE | README `Reviewer guide` section |
| 5.1 Tailoring | DONE | `tests/integration/phase5.tailoring.test.js` |
| 5.2 Relevance scoring | DONE | `tests/integration/phase5.tailoring.test.js` |
| 5.3 Rules capture and confirmation | DONE | `tests/integration/phase5.tailoring.test.js` |
| 6a MRSS | DONE | `tests/integration/phase1.remainder.test.js`; MRSS certification test |
| 6b Slack | DONE | `tests/integration/phase1.remainder.test.js`; Slack certification test |
| 6b Hashnode | DONE | `tests/integration/phase1.remainder.test.js`; Hashnode certification test |
| 7.1 Catalogue importer | DONE | `tests/integration/catalogue/catalogue.import.test.js` |
| 7.2 Generated 1,000-row time | DONE | `evidence/catalogue-1000-import.json` |
| 7.3 Real catalogue selftest scenario | DONE | `tests/integration/phase4.selftest.test.js` |
| 8.0 Phase and item reconciliation | DONE | This table and `docs/FORM_MAP.md` |
| 8.1 Metrics generation | DONE | `scripts/measure.ts`; `evidence/metrics.json`; `tests/unit/measure.test.js` |
| 8.2 Report, sources, and AI-use disclosure | DONE | `REPORT.md`, `SOURCES.md`, and `AI_USE.md`; the `exit` MIT licence and AI tools are confirmed |
| 8.3 Test, certification, and catalogue packs | PARTIAL | Packs exist; the unedited 10:09 demo video is at https://youtu.be/uj-4iZKrkFA; certification screenshots remain for Discourse, Dev.to, webhook, and assisted |
| 8.4 README completeness | DONE | `README.md`; live demo first `/ready` after idle took 22.7 seconds, next request took 0.3 seconds |
| 8.5 Clean-clone run | DONE | The Phase 9 clean clone passed startup/readiness, 72 suites / 400 tests, lint, build, eight batch outcomes, and the 14-case selftest; see `test-pack/outputs/batch/summary.json` and the Phase 9 verification below. |
| 8.6 Submission Form map | PARTIAL | `docs/FORM_MAP.md`; enter links in the form and confirm reviewer repository access |

## Test isolation

Audited destination inserts and fixed destination URLs/names across
`tests/integration/phase1.remainder.test.js`, `connectors.test.js`, `devto.test.js`,
`lemmy.test.js`, `ghost.test.js`, `catalogue/catalogue.import.test.js`,
`destinations/crud.test.js`, `destinations/duplicates.test.js`,
`destinations/validation.test.js`, `destinations/filters.test.js`,
`idempotency/destinations.idempotency.test.js`, `certification/certify.test.js`,
`certification/alerts.test.js`, `certification/cleanup.test.js`,
`certification/failure.test.js`, `certification/routes.validation.test.js`,
`certification/secrets.test.js`, `certification/helpers.js`,
`destinationTestHelpers.js`, `jobs/helpers.js`, `phase2.integration.test.js`,
`phase3.second-half.test.js`, `phase5.tailoring.test.js`,
`jobs/jobs.api.test.js`, `jobs/jobs.callback.test.js`, `jobs/jobs.storage.test.js`,
and `jobs/jobs.worker.test.js`.

The destination integration helper and certification/jobs reset helpers already clear
destination rows before each test. `devto.test.js`, `lemmy.test.js`, and `ghost.test.js`
already truncate destination-related tables in `beforeEach`. The phase 1 remainder suite
was the exception: it only cleared `publish_ledger`. It now truncates
`publish_ledger, destinations, certification_runs, destination_alerts CASCADE` in both
`beforeEach` and `afterAll`, while retaining all mock `_reset` calls and existing setup.
No test assertions or timeout settings were changed.

The Jest setup now pins `API_TOKEN`, `CONNECTORS_DISABLED`, `SIMULATION_MODE`,
`SEED_DEMO`, `STORAGE_DRIVER`, both local connection values, `CONNECTIONS_FILE`, and all
`JOBS_*` settings to deterministic test values. This prevents API authentication and other
host runtime settings from changing test behavior. `tests/unit/config.test.js` retains its
explicit environment expectations and was not changed.

The persistent PowerShell profile was configured and a fresh `powershell -NoLogo -Command
"Run-Case 'expired_token' 'check-1'"` succeeded with `CONNECTION_AUTH_EXPIRED` and no post.
Demo checks `docker compose ps` and `/ready` also passed. The full self-test rehearsal
command did not return captured output within 120 seconds and was stopped; its polling request
did not include authentication on GET when the host token may be enabled. Per the user's
stop-on-failure instruction, no further demo or proof commands were run. The Jest setup
changes and remaining demo steps are not yet verified.

Historical test-isolation attempt (25 Oct 2026) stopped at the first failing full-suite run:

```text
docker compose build api                                  PASS
phase1.remainder.test.js run 1                            Test Suites: 1 passed, 1 total
                                                         Tests:       28 passed, 28 total
phase1.remainder.test.js run 2                            Test Suites: 1 passed, 1 total
                                                         Tests:       28 passed, 28 total
docker compose run --rm api npm test (full run 1)         Test Suites: 1 failed, 71 passed, 72 total
                                                         Tests:       2 failed, 398 passed, 400 total
```

That run passed `tests/integration/phase1.remainder.test.js`, including the three
reported mock-connector tests, but stopped with two failures in
`tests/integration/errors.test.js`: `unsupported media type and oversized bodies retain
their client error statuses` expected HTTP 415 and received 401; `empty JSON body returns a
validation envelope` expected HTTP 400 and received 401. Per the test-isolation request,
no further suite, order-specific, lint, or build commands were run after this failure.
This is historical; the latest recorded successful full-suite gate remains 72 suites /
400 tests from the Phase 9 verification below.

## Latest repair and verification

### Phase 6a MRSS video feed connector (24 Oct 2026)

Added the MRSS feed connector at level L2 with a video surface, strict response checks,
marker-based reconciliation, and the required MIME types. Its simulation mock supports
normal, timeout-after-success, renamed-field, long-rate-limit, expired-token, rejected-content,
unavailable, and both delete-failure scenarios. `GET /feeds/{destination_id}.xml` builds RSS 2.0
and Media RSS by hand; text and attribute values escape all five XML-sensitive characters.
The connector is discoverable in the catalogue and contract test, and the feed route is in
`openapi.yaml`. Slack and Hashnode were completed in Phase 6b.

Docker verification:

```text
docker compose up --build -d                  PASS
docker compose run --rm api npm test          Test Suites: 71 passed, 71 total
                                              Tests:       376 passed, 376 total
docker compose run --rm api npm run lint      PASS
docker compose run --rm api npm run build     PASS
```

The required verbose tests all passed: `HARD CASE mrss timeout retry creates exactly one post`,
`HARD CASE mrss renamed field returns SCHEMA_DRIFT`, `mrss passes certification against its mock`,
`mrss secrets never appear in logs`, and `mrss feed escapes xml and lists published items`.
`openapi.yaml matches the registered routes exactly` and MRSS contract/catalogue assertions pass.

### Phase 6b Slack and Hashnode connectors (25 Oct 2026)

Added native Slack and Hashnode connectors with strict response checks, marker-based timeout
reconciliation, scenario mocks, secret-redaction checks, and six-step certification. Slack handles
Web API `ok:false` errors, bot-token auth, message history, and deletion; Hashnode handles GraphQL
publish, marker lookup, and removal. Both appear in the registry, catalogue, nine-connector contract
test, OpenAPI connector enum, and README.

Docker verification:

```text
docker compose up --build -d                  PASS
docker compose build api                      PASS
docker compose run --rm api npm test          Test Suites: 71 passed, 71 total
                                              Tests:       392 passed, 392 total
docker compose run --rm api npm run lint      PASS
docker compose run --rm api npm run build     PASS
```

Verbose required tests passed:
`HARD CASE slack timeout retry creates exactly one post`,
`HARD CASE slack renamed field returns SCHEMA_DRIFT`,
`slack passes certification against its mock`,
`slack secrets never appear in logs`,
`HARD CASE hashnode timeout retry creates exactly one post`,
`HARD CASE hashnode renamed field returns SCHEMA_DRIFT`,
`hashnode passes certification against its mock`, and
`hashnode secrets never appear in logs`.
The run also caught and fixed a shared response parser regression for string-valued Discourse
errors; the existing platform-message regression test passes.

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

At this historical checkpoint, assisted error handling, optional bearer-token support to `ix-batch`,
per-input result files, manifest downloads, and eight scenario-labelled inputs were verified. The
initial `batch_publish` handler was still not ready; Phase 9 below records the completed implementation
and supersedes that PARTIAL status.

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

At this checkpoint, the eight batch labels were fixtures and returned `JOB_TYPE_NOT_READY`. Phase 9
implements the simulation-only batch path, validates all expected outcomes, and closes Integration
Standard point 10; the older result is retained here as historical evidence.

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
in verbose runs. Phase 1 items 1.1–1.5 are verified. Current phase statuses are summarized
in the table at the top of this document.

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

### Phase 8 measurement and clean-clone verification (24 Oct 2026)

The refreshed metrics were generated by `npm run measure -- --api http://127.0.0.1:8000`
against the local Docker simulation. The script verified and removed both measurement posts.
The preserved records show two real L3 runs (Lemmy 785 ms; Ghost 1,201 ms); two successful
logical mock publications; zero duplicate posts; 13/13 expected rule violations caught across
24 fixture cases; and the protected 1,000-row catalogue record (880 imported, 100 duplicates,
120 errors, 2.626 seconds). Mock API cost is $0 per 1,000 publications; infrastructure is excluded.

A separate clone at `LongTail-clean-clone-phase8` had no `.env` or bootstrap credential file.
At that 24 Oct 2026 Phase 8 checkpoint, `docker compose up --build -d` started the default
stack and `/ready` returned database and storage checks `ok`. Its clean-clone Docker gate
reported 72 suites / 394 tests passed, with lint and build clean. `npm run seed` created 17
mock-only destinations. The documented batch CLI wrote `summary.json` and eight per-input
results; each job reported `JOB_TYPE_NOT_READY` because batch publishing had not yet been
implemented. After seeding, the real selftest job passed all 14 cases, and both report and
manifest downloads returned HTTP 200. The first unseeded selftest attempt is retained
separately to show why the documented seed step was required. See `test-pack/index.md`.

Docker verification on the source worktree after the measurement lint fix:

```text
docker compose build api                  PASS
docker compose run --rm api npm test      Test Suites: 72 passed, 72 total
                                           Tests:       394 passed, 394 total
docker compose run --rm api npm run lint  PASS
docker compose run --rm api npm run build PASS
```

Phase 8 remains PARTIAL: Submission Form entry, reviewer repository access, and four
certification screenshots require student follow-up. Cold-start timing, demo video, and AI
tool disclosure are now recorded. At this 24 Oct 2026 checkpoint, Phase 3 was also marked
PARTIAL because `batch_publish` had not yet been implemented; Phase 9 below supersedes that
status. Do not claim the assessment is complete while Phase 8 remains PARTIAL.

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

### Phase 9 finishing fixes (25 Oct 2026)

Implemented simulation-only `batch_publish` using the shared rules and connector publish path.
Each item records its expected and actual outcome, progress reaches 100, created posts are
deleted, and the job links its report and manifest. The eight sample inputs now target seeded
destinations and have explicit expected outcomes. The clean-clone `ix-batch` run wrote eight
per-input results and a summary with `total: 8`, `passed: 8`, and `failed: 0`; the copied
outputs are in `test-pack/outputs/batch/`.

Added `pretest` so a fresh checkout builds before Jest, raised Jest's timeout to 30 seconds,
enabled default demo seeding only in simulation mode, and added public `GET /` and
`GET /openapi.yaml`. The mock-certification command saved outputs for Discourse, Dev.to,
webhook, and assisted. The expanded measurement recorded 100/100 disposable simulated
publishes, 20/20 forced timeout retries, zero duplicates, 13/13 expected rule violations
caught with zero missed, and a $0 mock API cost estimate per 1,000 publishes. The protected
real certification and 1,000-row catalogue evidence were not edited.

Verification with the full Compose stack running:

```text
docker compose build api                      PASS before each test run
docker compose run --rm api npm test          Test Suites: 72 passed, 72 total
                                              Tests:       400 passed, 400 total
docker compose run --rm api npm run lint      PASS
docker compose run --rm api npm run build     PASS
```

The full Docker test gate passed twice consecutively at 72 suites / 400 tests. A separate
clean clone with no `.env`, `bootstrap-output.json`, `dist/`, or `node_modules/` also started
successfully, returned `/ready` with database and storage `ok`, and passed 72 suites / 400
tests, lint, build, eight of eight batch outcomes, and all 14 selftest cases. The clean-clone
batch summary and selftest report/manifest downloads are preserved under `test-pack/outputs/`.

Phase 3 is DONE; Phase 8 remains PARTIAL only for Submission Form entry, reviewer repository access, and
certification screenshots for Discourse, Dev.to, webhook, and assisted. Do not claim the
overall assessment is complete until those items are resolved.

## Next

The remaining Phase 8 tasks are entering Submission Form links, verifying reviewer repository
access, and capturing certification screenshots for Discourse, Dev.to, webhook, and assisted.
The assessment is not complete while Phase 8 remains PARTIAL.

## Evidence hygiene and documentation phase gate

The evidence encoding script re-wrote only `selftest-result.json` and `selftest-render.json`
as UTF-8 and verified parsed JSON equality. The evidence JSON encoding test passed as part of
the full suite. All 12 screenshot files were renamed from `.png.png` to `.png`; the screenshot
README lists their filenames. Rules-capture and catalogue claims were corrected in the docs.

Gate results:

```text
docker compose build api                      PASS
docker compose run --rm api npm test          Test Suites: 73 passed, 73 total
                                              Tests:       401 passed, 401 total
docker compose run --rm api npm run lint      FAIL: no-undef for TextDecoder in
                                              scripts/fix-evidence-encoding.js (lines 26, 43, 50)
                                              and tests/unit/evidence.encoding.test.js (line 15)
docker compose run --rm api npm run build     NOT RUN; stopped after lint failed
```

The first lint attempt failed because the configured ESLint globals do not include `TextDecoder`.
Both files now import `TextDecoder` from `node:util`; no lint rule or configuration was changed.
The rerun passed:

```text
docker compose build api                     PASS
docker compose run --rm api npm test         Test Suites: 73 passed, 73 total
                                             Tests:       401 passed, 401 total
docker compose run --rm api npm run lint     PASS
> eslint .

docker compose run --rm api npm run build    PASS
> tsc && node scripts/copyAssets.js
```

The corrected encoding code and evidence JSON test completed successfully.

## Phase 2 rules-capture provider gate — PARTIAL

Implemented the provider adapters, mock extraction, config and documentation updates, secret
redaction, rules-page URL checks, and optional live-capture command. No live provider was
called, and `evidence/rules-capture-real.json` remains absent. Both full Docker Jest runs
passed, including all eight required named tests. Lint failed, so Phase 2 is not complete and
Phase 3 has not started.

```text
docker compose build api                     PASS before each full test run
docker compose run --rm api npm test         Test Suites: 74 passed, 74 total
                                             Tests:       411 passed, 411 total
docker compose run --rm api npm test         Test Suites: 74 passed, 74 total
                                             Tests:       411 passed, 411 total
docker compose run --rm api npm run lint     FAIL
/app/tests/unit/llm.providers.test.js
  176:34  error  'setImmediate' is not defined  no-undef

✖ 1 problem (1 error, 0 warnings)
docker compose run --rm api npm run build    PASS
> tsc && node scripts/copyAssets.js
```
