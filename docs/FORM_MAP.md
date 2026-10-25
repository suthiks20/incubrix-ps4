# Submission Form evidence map

Statuses reflect checked-in proof and student-confirmed assessment details. Outstanding
capabilities not implemented are marked No.

## Must-haves 1-9

| # | Status | Claim | Exact proof |
|---|---|---|---|
| 1 | Yes | Connector Appendix A contract and shared errors | `tests/integration/connectors.contract.each.test.js`; `tests/integration/contract.compliance.test.js`; connector manifests |
| 2 | Yes | Six Core connector types have certification evidence | `tests/integration/certification/certify.test.js`; `tests/integration/devto.test.js` test `devto certifies as L3 with six passed steps`; `evidence/cert-lemmy-real.json`; `evidence/cert-ghost-real.json` |
| 3 | Yes | Adding destinations is catalogue configuration | `tests/integration/destinations/config-not-code.test.js`; `tests/integration/destinations/crud.test.js` |
| 4 | Yes | Rules run before publishing and return reasons/actions | `tests/integration/rules.contract.test.js`; `tests/unit/rules.engine.test.js`; `tests/fixtures/rule-cases.json` |
| 5 | Partial | No spam; local/mock certification posts are deleted | `tests/integration/certification/certify.test.js`; `tests/integration/phase4.selftest.test.js`; Lemmy deletion is a soft delete, and no hosted-platform posting is claimed |
| 6 | Yes | Same idempotency key does not create a second post after timeout | `tests/integration/connectors.test.js` test `HARD CASE timeout then retry creates exactly one post`; `tests/integration/phase1.remainder.test.js`; `evidence/metrics.json` |
| 7 | Yes | Secrets are redacted; local mocks are simulation-only | `tests/integration/secrets.test.js`; `tests/integration/phase1.remainder.test.js`; `src/app.ts` |
| 8 | Yes | One-command Docker start includes local services and works without `.env` | `docker-compose.yml`; Phase 9 clean-clone startup and `/ready` DB/storage checks in `docs/PROGRESS.md` |
| 9 | Yes | Integration Standard requirements | Points 1-10 are DONE in `docs/INTEGRATION_PROOF.md`; point 10 is proved by the three batch scenario and cleanup tests in `tests/integration/phase3.second-half.test.js` |

## Core connectors

| Connector | Status | Proof |
|---|---|---|
| Discourse | Yes | `tests/integration/certification/certify.test.js` test `certifies a Discourse destination with six passed steps and an empty mock` |
| Lemmy | Yes | `evidence/cert-lemmy-real.json` (passed L3, deletion confirmed); `tests/integration/lemmy.test.js` |
| Dev.to | Yes | `tests/integration/devto.test.js` test `devto certifies as L3 with six passed steps` |
| Ghost | Yes | `evidence/cert-ghost-real.json` (passed L3, deletion confirmed); `tests/integration/ghost.test.js` |
| Signed webhook | Yes | `tests/integration/certification/certify.test.js` test `certifies a webhook destination`; `tests/integration/webhook.test.js` |
| Assisted | Yes | `tests/integration/certification/certify.test.js` test `certifies an assisted destination as L1 with no network calls`; `tests/integration/assisted.test.js` |

## Advanced items

| Item | Status | Claim | Exact proof |
|---|---|---|---|
| 1 | Yes | Tailoring: discussion framing, canonical URL, word-boundary truncation, style changes | `tests/integration/phase5.tailoring.test.js` required tailoring tests |
| 2 | Yes | Deterministic relevance score and explanation stored | `tests/integration/phase5.tailoring.test.js` test `relevance score is between 1 and 5 with a reason` |
| 3a | Yes | MRSS feed, XML escaping, retry marker, certification | `tests/integration/phase1.remainder.test.js` MRSS tests; `tests/integration/certification/certify.test.js` |
| 3b | Yes | Slack Web API connector and mock certification | `tests/integration/phase1.remainder.test.js`; `tests/integration/certification/certify.test.js` |
| 3c | Yes | Hashnode GraphQL connector and mock certification | `tests/integration/phase1.remainder.test.js`; `tests/integration/certification/certify.test.js` |
| 4 | Yes | Rules capture proposal is pending until confirmation | `tests/integration/phase5.tailoring.test.js` required capture/confirm tests |
| 5 | Yes | Catalogue import with CSV, deduplication, language, errors, and 1,000-row timing | `tests/integration/catalogue/catalogue.import.test.js`; `evidence/catalogue-1000-import.json`; `evidence/metrics.json` |

## Integration Standard points 1-10

| Point | Status | Proof |
|---|---|---|
| 1 | Yes | Clean-clone startup and full tests: `docs/PROGRESS.md` Phase 9 verification; 72 suites / 400 tests passed, with the batch summary at `test-pack/outputs/batch/summary.json` |
| 2 | Yes | `openapi.yaml matches the registered routes exactly` in `tests/integration/phase2.integration.test.js` |
| 3 | Yes | Job 202 response, polling, and callback tests in `tests/integration/jobs/` |
| 4 | Yes | `HARD CASE same idempotency key returns the same job and runs the work once`; connector header idempotency tests |
| 5 | Yes | `tests/integration/errors.test.js`; `tests/integration/connectors.contract.each.test.js` |
| 6 | Yes | `.env.example lists every config setting` in `tests/integration/phase3.second-half.test.js` |
| 7 | Yes | `tests/integration/jobs/jobs.storage.test.js`; S3 storage adapter tests |
| 8 | Yes | readiness/health tests and `job log lines carry job_id and correlation_id` |
| 9 | Yes | `every job result links a manifest with all required keys` |
| 10 | Yes | Batch job scenarios, report/manifest links, and cleanup are verified by `batch_publish returns the expected outcome for each sample input`, `ix-batch eight sample inputs each match their expected outcome`, and `batch_publish leaves no test posts behind` in `tests/integration/phase3.second-half.test.js`. |

## Hard cases

| Hard case | Status | Exact proof |
|---|---|---|
| Timeout after success; retry same key; exactly one post | Yes | `tests/integration/connectors.test.js` test `HARD CASE timeout then retry creates exactly one post` |
| Short 429 waits for reset and succeeds | Yes | `tests/integration/connectors.test.js` test `HARD CASE short 429 is honoured and publish succeeds` |
| Long 429 returns retry-after | Yes | `tests/integration/connectors.test.js` test `HARD CASE long 429 returns PLATFORM_RATE_LIMIT with Retry-After header` |
| Expired platform token | Yes | `tests/integration/connectors.test.js` test `HARD CASE expired token returns CONNECTION_AUTH_EXPIRED` |
| Platform rejects content | Yes | `tests/integration/connectors.test.js` test `HARD CASE content rejected returns PLATFORM_CONTENT_REJECTED with the platform message in details` |
| Title too long | Yes | `tests/integration/connectors.test.js` test `HARD CASE title too long returns DEST_SPEC_VIOLATION and makes no platform request` |
| Body too long | Yes | `tests/integration/connectors.test.js` test `HARD CASE body too long returns DEST_SPEC_VIOLATION` |
| Unsupported media | Yes | `tests/integration/phase1.remainder.test.js` test `HARD CASE media type not accepted returns DEST_SPEC_VIOLATION with field-level reason` |
| Frequency cap | Yes | `tests/integration/rules.contract.test.js` test `HARD CASE second post inside the weekly cap is rescheduled with next_allowed_at`; `tests/integration/race.test.js` |
| Promotion to a no-promo destination | Yes | `tests/integration/rules.contract.test.js` test `HARD CASE promotional post to a no-promo destination is blocked`; Phase 4 selftest |
| Renamed platform response field | Yes | `tests/integration/connectors.test.js` test `HARD CASE renamed field returns SCHEMA_DRIFT naming topic_id`; connector-specific tests |
| CSV duplicate rows | Yes | `tests/integration/catalogue/catalogue.import.test.js` test `import dedupes on normalised url plus platform` |
| CSV bad URLs reported row-by-row | Yes | `tests/integration/catalogue/catalogue.import.test.js` test `import reports bad urls row by row` |
| Mixed-language catalogue rows | Yes | `tests/integration/catalogue/catalogue.import.test.js` test `import handles mixed languages` |
| Non-English community mismatch | Yes | `tests/integration/phase4.selftest.test.js` test `seeded destinations each trigger their intended rule or error code` |
| Required AI disclosure | Yes | `tests/integration/phase5.tailoring.test.js`; Phase 4 selftest |

## Outstanding items and student confirmation

| Item | Status | Proof or remaining action |
|---|---|---|
| Outstanding recommender with labelled-set precision | No | No recommender or labelled precision evaluation is implemented. |
| `fetch_metrics` on 3+ connectors | Yes | Discourse, Dev.to, and Ghost; `tests/integration/phase1.remainder.test.js` |
| 30-day recertification scheduler | No | Demotion and alerts exist; no recertification scheduler is implemented. |
| Real catalogue of 150+ destinations | No | `catalogue-1000.csv` contains generated `example.com` data, not a real destination catalogue. |
| Hosted demo cold-start measurement | Yes | First `/ready` after idle: 22.7 seconds (HTTP 200); next request: 0.3 seconds; [README](../README.md) |
| Reviewer screenshots and video | Yes | Six screenshots are in `certification-pack/screenshots/`; unedited 10:09 video: https://youtu.be/uj-4iZKrkFA. The IncuBrix team confirmed that up to 10 minutes is acceptable. Discourse, Dev.to, webhook, and assisted still lack certification screenshots. |
| AI tools used | Yes | `AI_USE.md` documents GitHub Copilot and Claude; no other tools were used. |
| Submission Form/reviewer access | Partial | TODO(student): enter the links from this map in the live form and verify repository access. |
