# IncuBrix Long-Tail Destination Network

The IncuBrix Long-Tail Destination Network is a Node.js/Fastify service for publishing content to community destinations. Phase 4 adds a manifest-driven connector framework, the Discourse connector, a simulation platform, and a durable publish ledger.

## Module layering

Every module follows: route -> handler -> service -> repository. Routes declare HTTP, handlers read requests and send replies, services contain business logic and throw `AppError`, and repositories contain only Knex queries.

```text
src/modules/<module>/
├── commons/constants.js
├── routes/index.js
├── handlers/
├── services/
├── repository/<module>.js
└── schemas/
```

## Setup and verification

Copying `.env.example` to `.env` is optional and only needed to override the Compose defaults. Start and verify with:

```bash
docker compose up --build -d
docker compose run --rm api npm test
docker compose run --rm api npm run lint
```

The single command that runs all tests is `docker compose run --rm api npm test`.

## Destinations API

All destination endpoints are under `/api/v1/destinations`. When `API_TOKEN` is set, requests require `Authorization: Bearer <token>`; `/health` and the versioned health routes remain public.

| Method | Path | Result |
| --- | --- | --- |
| POST | /api/v1/destinations | 201 with created destination |
| GET | /api/v1/destinations | 200 with items, total, limit, offset |
| GET | /api/v1/destinations/:id | 200 with destination |
| PUT | /api/v1/destinations/:id | 200 with updated destination |
| DELETE | /api/v1/destinations/:id | 200 with `{ "deleted": true }` |

The sample JSON files live in `samples/destinations`. In Windows Command Prompt, start the stack, then post a sample with:

```bat
curl.exe -X POST http://localhost:8000/api/v1/destinations -H "Content-Type: application/json" -H "Idempotency-Key: demo-001" --data-binary "@samples\destinations\discourse-forum-a.json"
```

If authentication is enabled, add `-H "Authorization: Bearer YOUR_API_TOKEN"` to the command. Reuse an idempotency key only for the same request; use a new key for a new attempt. A duplicate destination with a different key returns `409 DUPLICATE_DESTINATION`. The `level`, `last_certified_at`, and `demoted` fields are server-managed: new destinations start at level `L0`, and later certification code can update those fields. Clients may still set `enabled` to disable a destination.

## Idempotency

Every `POST` whose path starts with `/api/v1` requires an `Idempotency-Key` header containing 1–255 printable ASCII characters. A repeat with the same key, method, path, and request content replays the stored status and body and adds `Idempotent-Replay: true`. Reusing the same key for different request content returns `409 IDEMPOTENCY_KEY_CONFLICT`. If the original request is still running, the duplicate waits up to `IDEMPOTENCY_WAIT_MS`, then returns retryable `409 IDEMPOTENCY_REQUEST_IN_PROGRESS` if it has not finished. Completed keys are retained for `IDEMPOTENCY_TTL_HOURS`; abandoned in-progress claims can be reclaimed after `IDEMPOTENCY_LOCK_TTL_SECONDS`. Connector publish accepts the same header or the legacy JSON `idempotency_key`; when both are supplied they must match. Health routes and non-POST methods are excluded.

## Connector contract

`POST /connector/v1/:key/:method` accepts `destination_ref` (the connector API base URL), `connection`, `rendition`, and `idempotency_key`. `destination_id` may be supplied instead to load a saved destination. Contract schemas intentionally accept additional properties so the request can evolve without changing the common envelope. Destination records use their `config.base_url`; connection values use `api_key` and `api_username`. The API key is only sent to the platform and is never persisted or returned.

### Assumed contract schemas

The Phase 4 request shapes are `rendition: { title, body, language?, is_promotional?, ai_generated?, canonical_url?, links?: string[], media?: { url, type }[] }`, `destination: { config: { base_url }, enabled? }`, and `connection: { api_key, api_username }`. Title and body are required by publish validation; unknown extra fields are accepted for forward compatibility.

The Discourse manifest is the source of destination limits and platform error mappings. Publishing validates the title/body against the manifest and uses a hidden `ix-ref` marker for recovery. The ledger distinguishes `in_flight`, `published`, `unknown`, and `failed`; after a network failure the next request searches by marker before attempting another create.

| Simulation scenario | Result |
| --- | --- |
| normal | Creates and reads posts normally |
| timeout_after_success | Creates once, then drops the response connection |
| unavailable | Returns a platform 503 |
| rate_limit / rate_limit_long | Returns a short retryable 429 / a long 429 with Retry-After |
| expired_token / revoked | Returns 401 / 403 |
| content_rejected | Returns 422 |
| renamed_field | Returns a changed response field to trigger SCHEMA_DRIFT |

## Rules engine

`POST /api/v1/rules/evaluate` is a pure dry run. The engine checks, in order: enabled/demoted state, automation permission, rolling frequency cap, self-promotion, link policy, AI disclosure, and language. Its decisions are `allow`, `block`, `reschedule`, or `assist`; block takes precedence over assist, then reschedule. Reasons always state the action taken, for example `DEST_RULE_FREQUENCY_CAP` supplies `next_allowed_at`, while `AI_DISCLOSURE_APPENDED` reports that the disclosure was appended. The fixture summary is: `rule cases: 24, caught: 24, missed: 0`.

Frequency history includes published, in-flight, and unknown ledger rows so concurrent distinct keys are less likely to exceed a cap. The current per-destination publish lock is in-process and therefore protects a single service instance; production should use a per-destination PostgreSQL advisory lock.

## Webhook connector

The protocol connector signs the exact raw request body string sent using `sha256=` plus the HMAC-SHA256 of `${timestamp}.${rawBody}` with `connection.signing_secret`. For example, `sign('test-signing-secret', '1700000000', '{"title":"Hi"}')` produces the value sent in `X-IncuBrix-Signature`; `X-IncuBrix-Timestamp` holds the Unix seconds. The secret is redacted from logs, responses, and platform messages.

Webhook simulation scenarios are `normal`, `bad_signature`, `partner_revoked`, `timeout_after_success`, `unavailable`, `rate_limit_long`, and `renamed_field`. They live under `/mock/webhook/:scenario` and are enabled only with `SIMULATION_MODE=true`.

## Assisted connector

`POST /connector/v1/assisted/build_assist_pack` makes a caption, media file list, destination deep link, and rule-derived checklist for a person to post. Its publish/status/delete methods intentionally return `501 CONNECTOR_NOT_IMPLEMENTED`; it makes no network calls and does not create ledger rows.

In Windows Command Prompt, use `/mock/discourse/timeout_after_success` for the ambiguous-success recovery scenario (the demo credentials are for local simulation only):

```bat
curl.exe -X POST http://localhost:8000/connector/v1/discourse/publish -H "Content-Type: application/json" --data-raw "{\"idempotency_key\":\"demo-publish-001\",\"destination_ref\":\"http://localhost:8000/mock/discourse/timeout_after_success\",\"connection\":{\"api_key\":\"demo\",\"api_username\":\"tester\"},\"rendition\":{\"title\":\"An example topic title\",\"body\":\"Hello community\"}}"
```

## Dev.to connector

Dev.to is a native `article` connector with title and body limits of 128 and 100000 characters. It sends the
connection API key as `api-key`, publishes a hidden `<!-- ix_ref:<marker> -->` comment in `body_markdown`, and
uses that marker to reconcile an ambiguous timeout. Dev.to has no hard-delete endpoint: delete sets
`published:false`, and the connector treats an unpublished article as gone only after `get_status` confirms it.

| Simulation scenario | Result |
| --- | --- |
| normal | Publishes, reads, and unpublishes an article |
| timeout_after_success | Creates once and drops the create response |
| renamed_field | Replaces `url` with `article_url` to trigger `SCHEMA_DRIFT` |
| rate_limit_short / rate_limit_long | Returns 429 with Retry-After 1 / 120 |
| expired_token / content_rejected / unavailable | Returns 401 / 422 / 503 |
| delete_fails_once / delete_fails_twice | Fails one or two unpublish attempts |

Windows Command Prompt example (the key can be in the header or JSON body, but not differently in both):

```bat
curl.exe -X POST http://localhost:8000/connector/v1/devto/publish ^
  -H "Content-Type: application/json" ^
  -H "Idempotency-Key: devto-publish-001" ^
  --data "{\"destination_ref\":\"http://localhost:8000/mock/devto/normal\",\"connection\":{\"api_key\":\"fake-devto-key\"},\"rendition\":{\"title\":\"Example Devto article\",\"body\":\"A local simulation article.\",\"canonical_url\":\"https://example.test/original\"}}"
```

## Certification

Certification validates a destination with a temporary local test post. Native and protocol connectors run six
steps in order: `validate`, `publish`, `confirm_live`, `read_status`, `delete`, and `verify_gone`. Assisted
destinations run validation and build an assist pack; their platform steps are recorded as skipped with no
network call.

Certification awards L1 to `assisted`, L2 to `feed` and `bridge`, and L3 to `native` and `protocol`
connectors. A failed run has completed cleanup and remains `failed`; a `cleanup_pending` run still has a test
post and is retried by the janitor. The initial cleanup deadline is 10 minutes (`CERT_TEST_POST_TTL_MINUTES`).
The server runs the janitor at startup and every `CERT_JANITOR_INTERVAL_SECONDS`; failed janitor retries move
the deadline forward by one minute and create only one `cleanup_failed` alert per run.

For safety, a non-assisted destination must have `config.base_url` and its host must be listed in
`CERT_ALLOWED_HOSTS`, unless the destination's config explicitly enables `sandbox`. Certification refuses an
unapproved host before it creates a run, sends a platform request, alerts, or demotes a destination.

Certification-specific errors are `CERT_CONFIG_INVALID`, `CERT_HOST_NOT_ALLOWED`, and
`DESTINATION_DEMOTED`; all use the common `{error:{code,message,retryable,details}}` envelope.

This evidence excerpt is copied from a passing local Docker run on 22 Oct 2026. It contains no connection
values:

```json
{
  "run_id": "81d61b2d-43bb-4724-9edc-7518d3ad0c3a",
  "platform_post_id": "1",
  "deletion_confirmed": true,
  "verdict": "passed",
  "totals": { "duration_ms": 75 },
  "destination": {
    "name": "Docker Evidence Discourse",
    "url": "http://127.0.0.1:8000/mock/discourse/normal",
    "connector_key": "discourse",
    "platform_key": "discourse"
  },
  "connector": { "key": "discourse", "version": "1.0.0" },
  "steps": [{ "name": "validate", "status": "passed", "duration_ms": 0 }]
}
```

## Jobs

`POST /api/v1/jobs` queues durable work and returns `202` immediately. Jobs move from `queued` to `running`,
then `succeeded` or `failed`; certification is the first supported type. A repeated idempotency key for the
same body returns the same `job_id`. Unknown types return `JOB_TYPE_UNKNOWN`.

Callbacks receive `{job_id,status,result,error}`. The API signs its exact JSON body with
`X-IncuBrix-Signature: sha256=<HMAC-SHA256(timestamp.body)>` and sends the Unix timestamp in
`X-IncuBrix-Timestamp`.

```bat
curl.exe -X POST http://localhost:8000/api/v1/jobs -H "Content-Type: application/json" ^
  -H "Idempotency-Key: job-001" --data "{\"type\":\"certify\",\"input\":{\"destination_id\":\"UUID\"}}"
curl.exe http://localhost:8000/api/v1/jobs/JOB_UUID -H "Idempotency-Key: job-read-001"
curl.exe http://localhost:8000/api/v1/jobs?status=queued -H "Idempotency-Key: jobs-list-001"
```

In Windows Command Prompt, use these routes after creating a destination. `Idempotency-Key` is required for
the POST routes; it is included below on the reads as a harmless trace header for a copy-paste-friendly set.

```bat
set DESTINATION_ID=replace-with-destination-uuid
set RUN_ID=replace-with-run-uuid

curl.exe -X POST "http://localhost:8000/api/v1/destinations/%DESTINATION_ID%/certify" ^
  -H "Content-Type: application/json" ^
  -H "Idempotency-Key: certify-001" ^
  --data "{}"

curl.exe "http://localhost:8000/api/v1/certification/runs" ^
  -H "Idempotency-Key: runs-001"

curl.exe "http://localhost:8000/api/v1/certification/runs/%RUN_ID%/evidence" ^
  -H "Idempotency-Key: evidence-001"

curl.exe "http://localhost:8000/api/v1/alerts" ^
  -H "Idempotency-Key: alerts-001"

curl.exe -X POST "http://localhost:8000/api/v1/certification/cleanup" ^
  -H "Content-Type: application/json" ^
  -H "Idempotency-Key: cleanup-001" ^
  --data "{}"

curl.exe "http://localhost:8000/api/v1/certification/summary" ^
  -H "Idempotency-Key: summary-001"
```

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| NODE_ENV | development | Runtime environment |
| PORT | 8000 | HTTP listening port |
| HOST | 0.0.0.0 | HTTP listening host |
| LOG_LEVEL | info | Pino severity threshold |
| DATABASE_URL | required | PostgreSQL connection string |
| PUBLIC_BASE_URL | http://localhost:8000 | Public service URL |
| SIMULATION_MODE | true | Future simulation switch |
| DB_AUTO_MIGRATE | true | Apply pending migrations before listening |
| API_TOKEN | empty | Optional bearer token; empty disables authentication |
| TEST_DATABASE_URL | optional | Isolated database used by Jest integration tests |
| IDEMPOTENCY_TTL_HOURS | 24 | Hours a completed request key is retained |
| IDEMPOTENCY_WAIT_MS | 5000 | Maximum time a duplicate waits for an active request |
| IDEMPOTENCY_LOCK_TTL_SECONDS | 60 | Age after which an unfinished claim is reclaimed |
| CONNECTOR_HTTP_TIMEOUT_MS | 10000 | Per-request platform HTTP timeout |
| CONNECTOR_MAX_BACKOFF_MS | 5000 | Maximum automatic wait for one rate-limit retry |
| CIRCUIT_FAILURE_THRESHOLD | 5 | Consecutive unavailable responses before opening a connector circuit |
| CIRCUIT_COOLDOWN_SECONDS | 60 | Seconds before an open circuit can retry |
| STORAGE_DRIVER | local | Certification evidence storage driver |
| STORAGE_DIR | ./data/storage; /app/data/storage in Compose | Directory for local certification evidence |
| CERT_TEST_POST_TTL_MINUTES | 10 | Maximum lifetime of a certification test post |
| CERT_JANITOR_INTERVAL_SECONDS | 60 | Seconds between certification janitor cleanup attempts |
| CERT_ALLOWED_HOSTS | 127.0.0.1,localhost | Hosts allowed to receive certification posts |
| CONNECTORS_DISABLED | empty | Comma-separated connector keys disabled by configuration |
| JOBS_POLL_INTERVAL_MS | 1000 | Milliseconds between queued-job polls |
| JOBS_MAX_ATTEMPTS | 3 | Maximum stale-job retry attempts |
| JOBS_STALE_SECONDS | 300 | Running-job stale threshold in seconds |
| JOBS_CALLBACK_SECRET | dev-callback-secret | HMAC secret for job callbacks |
| JOBS_CALLBACK_TIMEOUT_MS | 5000 | Callback request timeout in milliseconds |

## Error codes

| Group | Codes |
| --- | --- |
| Connector | DEST_SPEC_VIOLATION, DEST_RULE_FREQUENCY_CAP, CONNECTION_AUTH_EXPIRED, PLATFORM_RATE_LIMIT, PLATFORM_QUOTA_EXHAUSTED, PLATFORM_CONTENT_REJECTED, PLATFORM_UNAVAILABLE, CONNECTOR_DISABLED |
| Connector framework extensions | SCHEMA_DRIFT, DEST_RULE_VIOLATION, DESTINATION_DEMOTED, CERT_HOST_NOT_ALLOWED, CERT_CONFIG_INVALID |
| Jobs | JOB_TYPE_UNKNOWN |
| Platform | VALIDATION_ERROR, UNSUPPORTED_MEDIA_TYPE, PAYLOAD_TOO_LARGE, NOT_FOUND, UNAUTHORIZED, IDEMPOTENCY_KEY_REQUIRED, IDEMPOTENCY_KEY_CONFLICT, IDEMPOTENCY_REQUEST_IN_PROGRESS, RATE_LIMITED, NOT_READY, INTERNAL_ERROR, CONNECTOR_NOT_IMPLEMENTED, DESTINATION_DISABLED |
| Destinations | DUPLICATE_DESTINATION |

## Phases


- Phase 1 — done: project skeleton, health/readiness, configuration, errors, logging, tests, and Docker.
- Phase 2 — done: migrations, optional bearer authentication, and destinations API.
- Phase 3 - done: idempotency claims, response replay, and concurrent duplicate protection.
- Phase 3.5 cleanup - done: client error envelopes, server-managed destination fields, and config cleanup.
- Phase 4 - done: connector framework, Discourse, simulator, and publish ledger.
- Phase 5 - done: rules engine, webhook, assisted connector, race protections, and simulation coverage.
