# Certification spec (source of truth for prompts S1 to S7)

This file is the single reference for the certification work. Each prompt says "do section X".

## A. Readability rules

- One statement per line. No line over 110 characters. No function over 40 lines.
- Every file starts with a 2-3 line comment saying what it does and why.
- Layering stays route -> handler -> service -> repository.

## B. Target layout: src/modules/certification/

- commons/constants.js: STEP_NAMES, levelFor(tier) (assisted L1, feed/bridge L2, native/protocol L3), ALLOWED_RUN_FILTERS
- routes/index.js
- handlers/: certify, getRuns, getRun, getEvidence, getAlerts, acknowledgeAlert, cleanup, getSummary, index
- services/: run.js (orchestrator under 80 lines), preconditions.js, steps.js, outcome.js, evidence.js,
  immediateCleanup.js, cleanup.js, summary.js, alerts.js
- repository/: runs.js, alerts.js, __mocks__/knex.mock.js
- schemas/: one file per endpoint plus index.js

Other changes:

- Migration 20261024_005_certification_steps.js adds `steps jsonb not null default '[]'` to certification_runs.
- New error code CERT_CONFIG_INVALID (409, retryable false) in codes.js and the README error table.

Already built, reuse and do not rewrite: src/shared/storage, src/shared/connections/resolve.js,
migration 20261023_004_create_certification.js, CERT_HOST_NOT_ALLOWED.

## C. Step semantics

Native and protocol tiers run six steps in order:
validate, publish, confirm_live, read_status, delete, verify_gone.

Assisted tier: validate and build_assist_pack run. The other five steps are recorded as skipped with
summary "assisted tier: a person posts". No network call at all.

Each recorded step is `{name, status: passed|failed|skipped, started_at, duration_ms, summary}`.
Summaries are specific (for example "created post 1 at <live_url>"), never just "completed".
Durations come from the injected clock (deps.now).

When a step fails:

1. Record it as failed with error `{code, message}`.
2. Record every later step as skipped with summary "skipped: <step> failed".
3. Stop.

After a failure, if a platform_post_id exists and the post is not deleted:

- Make ONE immediate best-effort delete, recorded as an extra step named "cleanup".
- If it succeeds: test_post_deleted true, run status "failed".
- If it fails: run status "cleanup_pending", test_post_deleted false,
  cleanup_due_at = now + CERT_TEST_POST_TTL_MINUTES.
- If publish failed and there is no post id, try to find a leftover post by its marker before giving up.

On a failed run:

- failure_step = the failed step name, failure_code = error.code or INTERNAL_ERROR, failure_message.
- destination.demoted = true. level and last_certified_at are unchanged.
- Exactly ONE alert. Kind "schema_drift" when the code is SCHEMA_DRIFT, otherwise "certification_failed".
  Details: `{code, failure_step, run_id}`.

On a passed run: level = levelFor(tier), last_certified_at = finish time, demoted = false.

Evidence JSON is written for passed AND failed runs. Fields: run_id, destination (name, url, connector_key,
platform_key), connector (key, version), steps, platform_post_id, live_url, post_created_at, post_deleted_at,
minutes_alive, deletion_confirmed, verdict, failure (when failed), totals.
It must NEVER contain any connection value.

Certification publishes through the connector directly: no ledger rows, no frequency-cap count.

Preconditions (throw BEFORE any run row, alert or demotion exists):

- Destination missing: 404 NOT_FOUND.
- Connector disabled: 409 CONNECTOR_DISABLED.
- Host not in CERT_ALLOWED_HOSTS and config.sandbox not true: 409 CERT_HOST_NOT_ALLOWED.
- Missing config.base_url on a non-assisted destination: 409 CERT_CONFIG_INVALID.

A failed run still returns HTTP 200 with the run, its steps and evidence_link.

## D. HTTP layer

- Every route has a schema. Ids use format uuid.
- Runs query allows only destination_id (uuid), status (passed|failed|cleanup_pending),
  limit (1-200, default 50) and offset, with additionalProperties false.
- Alerts query allows destination_id and acknowledged (boolean).
- Unknown run, evidence or alert: 404 NOT_FOUND thrown by the service layer.
- certify, alerts acknowledge and cleanup POSTs require Idempotency-Key.

## E. Janitor, mocks, summary

Discourse mock:

- Count DELETE calls per scenario in state.delete_attempts (shown by _state).
- Scenarios delete_fails_once and delete_fails_twice: the first one or two DELETEs return 503, later ones succeed.

services/cleanup.js runCleanup(deps):

- Finds runs with status cleanup_pending and cleanup_due_at <= now.
- Deletes each test post through its connector.
- Success: status "failed", test_post_deleted true, cleaned_at = now, evidence file
  certification/<destination>/<run>.cleanup.json with deleted_at and minutes_after_publish.
- Failure: stays cleanup_pending, cleanup_due_at moves forward one minute, ONE cleanup_failed alert per run
  (never duplicates).
- Returns `{checked, cleaned, failed}`.

Routes and server:

- POST /api/v1/certification/cleanup runs it once and returns that summary.
- src/server.js runs it once at startup and then every CERT_JANITOR_INTERVAL_SECONDS using setInterval.
  Unref the timer, catch and log errors, clear it on shutdown. buildApp must NOT start the timer.
- GET /api/v1/certification/summary returns, per connector_key: runs, passed, failed, avg_duration_ms,
  destinations_certified, test_posts_left_undeleted, max_minutes_alive.

## F. Tests (names exact; write each test before its implementation)

Helpers: tests/integration/certification/helpers.js. Injected clock, temp storage dir, listen on port 0,
destinations with config.base_url http://127.0.0.1:PORT/mock/CONNECTOR/UNIQUE_SCENARIO,
TRUNCATE ... CASCADE between tests, CERT_ALLOWED_HOSTS includes 127.0.0.1.

### certify.test.js

- 'certifies a Discourse destination with six passed steps and an empty mock'
- 'certifies a webhook destination'
- 'certifies an assisted destination as L1 with no network calls' (spy on fetch: zero calls)
- 'HARD CASE certification refuses a non-sandbox host'
- 'certification does not count toward the frequency cap'
- 'HARD CASE certification retry with the same idempotency key does not publish a second test post'
- 'recertification keeps the level and refreshes last_certified_at'
- 'run record stores its steps and GET run by id returns them'

### failure.test.js

- 'HARD CASE renamed field fails certification and demotes the destination'
  (publish failed, validate passed, four steps skipped, SCHEMA_DRIFT, schema_drift alert, then
  POST /connector/v1/discourse/publish for that destination returns 409 DESTINATION_DEMOTED and the
  mock attempt count does not increase)
- 'HARD CASE recertification clears the demotion'
- 'certification of an unavailable platform fails with PLATFORM_UNAVAILABLE'
- 'certification with an expired token fails with CONNECTION_AUTH_EXPIRED'
- 'HARD CASE delete fails once and the immediate cleanup removes the test post'
- 'HARD CASE delete fails twice and the run is cleanup_pending with a due time'
- 'certification without config.base_url returns CERT_CONFIG_INVALID'
- 'certification of a disabled connector returns CONNECTOR_DISABLED'

### cleanup.test.js

- 'HARD CASE janitor deletes a leftover test post once it is due'
  (injected clock; nothing before due; after due the post is gone, cleaned_at set, cleanup evidence written)
- 'janitor ignores runs that are not due'
- 'janitor failure keeps the run pending and raises one cleanup_failed alert'
- 'POST /certification/cleanup returns a summary'
- 'summary reports per-connector metrics'

### routes.validation.test.js

- 'certify with an invalid uuid returns 400 VALIDATION_ERROR'
- 'certify an unknown destination returns 404 NOT_FOUND'
- 'unknown run returns 404 NOT_FOUND'
- 'unknown evidence returns 404 NOT_FOUND'
- 'runs list rejects unknown filters, bad status and bad limit with 400'
- 'runs list filters by destination_id and status'
- 'certify without Idempotency-Key returns 400 IDEMPOTENCY_KEY_REQUIRED'
- 'certification routes require the bearer token when API_TOKEN is set'

### alerts.test.js

- 'alerts list filters by destination and acknowledged'
- 'acknowledge sets acknowledged'
- 'acknowledge unknown alert returns 404 NOT_FOUND'

### secrets.test.js

- 'certification never leaks connection secrets'
  (capture logs through a pino stream; fake api_key, api_username and signing_secret supplied via
  CONNECTION_REF must never appear in logs, responses, run rows, alert rows or evidence files,
  for a passing and a failing run)

### Unit tests: tests/unit/certification.*.test.js

- Step recorder: pass, fail, skip rest, durations.
- levelFor by tier.
- Preconditions: allowed host, sandbox flag, disallowed host, missing base_url.
- Evidence builder strips connection fields.
- Outcome decides run status (failed vs cleanup_pending).
- resolveConnection: env JSON parsing, simulation fallback, non-simulation failure, ref normalisation
  (only if not already tested).

Every error assertion matches `{error:{code,message,retryable,details}}`.
