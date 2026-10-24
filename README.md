# IncuBrix Long-Tail Destination Network

The IncuBrix Long-Tail Destination Network is a Node.js/Fastify service for safely publishing
content to configured community destinations. It uses connector manifests, policy checks,
idempotent publishing, a durable ledger, queued jobs, and S3-compatible artifact storage.

## Architecture

Every module follows route -> handler -> service -> repository. Connectors call destination
platform APIs only after policy and validation checks.

```text
Reviewer / CLI
      |
      v
Fastify API -> routes -> handlers -> services -> repositories -> PostgreSQL
      |                 |                 |
      |                 |                 +-> publish ledger / job worker
      |                 +-> connector registry -> platform connectors -> destinations
      +-> S3 storage adapter -> SeaweedFS (local Docker)
                                  |
                                  +-> job outputs, manifests, certification evidence
```

## Setup and verification

Node 22 and Docker Compose are required. `.env` is optional; the default Compose settings
are intended to work without it. From a clean clone, start and verify with these commands:

```bash
docker compose up --build -d
docker compose build api
docker compose run --rm api npm test
docker compose run --rm api npm run lint
docker compose run --rm api npm run build
```

The API source is copied into the image, not bind-mounted, so rebuild with
`docker compose build api` before running changed Jest tests.
The default stack starts the API, PostgreSQL, SeaweedFS storage, local Lemmy and Ghost instances,
and a one-shot bootstrap service. Allow about 6 GB of Docker memory for all services.
The API starts independently of Lemmy and Ghost; the bootstrap waits for both platforms to be healthy
and writes their credentials to `/app/data/connections.json` in the shared `certdata` volume.
The optional `CONNECTIONS_FILE` setting defaults to that path. Per-connection environment values
override matching fields from the file.

For simulation-only development without the local platforms, start just:

```bash
docker compose up api postgres minio minio-init
```

After the default stack is healthy, certify the two local instances through the API and write
secret-free evidence:

```bash
docker compose run --rm api npm run certify:real
```

The command prints only status, level, and step outcomes. The integration evidence test is skipped
until both `evidence/cert-lemmy-real.json` and `evidence/cert-ghost-real.json` exist.

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

## Catalogue CSV import

`POST /api/v1/catalogue/import` accepts a base64 CSV upload or a public HTTP(S) CSV URL and returns a
`202` job response. CSV headers must be unique and use the destination fields `name`, `url`,
`platform_key`, and `connector_key`; optional fields include `category`, `description`,
`audience_tags`, `language`, `geo`, and `rules_url`. Credential/configuration columns are rejected.
URLs are normalized before de-duplication on `(platform_key, url)`. Reachability checks use a 1.5-second
timeout and a concurrency limit of 50; member counts use deterministic mock enrichment unless the
import service is given an injected provider. Language detection uses script ranges and common stopwords.
Every job stores a row-by-row error CSV and exposes it through `links.errors`.

In Windows Command Prompt, generate a 1,000-row fixture and submit it from an accessible CSV URL:

```bat
npm run build
npm run gen-catalogue
curl.exe -X POST http://localhost:8000/api/v1/catalogue/import -H "Content-Type: application/json" -H "Idempotency-Key: catalogue-demo-001" --data-raw "{\"source\":{\"url\":\"https://example.com/catalogue.csv\"}}"
```

The generated fixture contains duplicate URLs, invalid schemes, and English/Spanish text. The integration
test imports it with mocked reachability, records the actual elapsed time and counts in
`evidence/catalogue-1000-import.json`, and verifies the under-five-minute target. No new environment
settings are needed for catalogue import.

## Simulation demo seed and self-test

`npm run seed` applies migrations and idempotently creates mock-only demo destinations. It creates rows
only when `SIMULATION_MODE=true`; API startup performs the same seed automatically when
`SEED_DEMO=true`. The seeded destinations use local mock routes and fake simulation credentials,
never real platform credentials.

Queue all hidden-case checks with:

```powershell
curl.exe -X POST http://localhost:8000/api/v1/selftest -H "Idempotency-Key: reviewer-selftest" -H "Content-Type: application/json" --data-raw "{}"
```

The job result includes a `links.report` URL and a `links.manifest` URL. Poll
`GET /api/v1/jobs/{job_id}` until the status is terminal, then fetch each link. Requests can include a
single `case` to review that one scenario; omitting it runs the full set. When `API_TOKEN` is enabled,
add `-H "Authorization: Bearer $env:API_TOKEN"` to the command.

### Reviewer guide

Run these commands only against the local simulation stack. Each queues one case; expected code and
system behavior are shown alongside it. Poll the returned `job_id` and download `links.report` to see
the case result. Add the bearer header if API authentication is enabled.

| Hard case | Copy-paste curl | Expected result |
| --- | --- | --- |
| Timeout and same-key retry | `curl.exe -X POST http://localhost:8000/api/v1/selftest -H "Idempotency-Key: review-timeout" -H "Content-Type: application/json" --data-raw '{"case":"timeout_then_retry"}'` | `PLATFORM_UNAVAILABLE`; retry replays the marker-matched post, exactly one post exists, then it is deleted. |
| 429 reset honored | `curl.exe -X POST http://localhost:8000/api/v1/selftest -H "Idempotency-Key: review-rate-limit" -H "Content-Type: application/json" --data-raw '{"case":"rate_limit_reset_honored"}'` | `PLATFORM_RATE_LIMIT`; waits for the mock reset and retries successfully. |
| Expired token | `curl.exe -X POST http://localhost:8000/api/v1/selftest -H "Idempotency-Key: review-expired" -H "Content-Type: application/json" --data-raw '{"case":"expired_token"}'` | `CONNECTION_AUTH_EXPIRED`; no post is created. |
| Content rejected | `curl.exe -X POST http://localhost:8000/api/v1/selftest -H "Idempotency-Key: review-rejected" -H "Content-Type: application/json" --data-raw '{"case":"content_rejected"}'` | `PLATFORM_CONTENT_REJECTED`; no post is created. |
| Title too long | `curl.exe -X POST http://localhost:8000/api/v1/selftest -H "Idempotency-Key: review-title" -H "Content-Type: application/json" --data-raw '{"case":"title_too_long"}'` | `DEST_SPEC_VIOLATION`; the title is rejected before publish. |
| Body too long | `curl.exe -X POST http://localhost:8000/api/v1/selftest -H "Idempotency-Key: review-body" -H "Content-Type: application/json" --data-raw '{"case":"body_too_long"}'` | `DEST_SPEC_VIOLATION`; the body is rejected before publish. |
| Unsupported media | `curl.exe -X POST http://localhost:8000/api/v1/selftest -H "Idempotency-Key: review-media" -H "Content-Type: application/json" --data-raw '{"case":"media_not_accepted"}'` | `DEST_SPEC_VIOLATION`; report names `media[0].type` and its allowed types. |
| Weekly frequency cap | `curl.exe -X POST http://localhost:8000/api/v1/selftest -H "Idempotency-Key: review-cap" -H "Content-Type: application/json" --data-raw '{"case":"second_post_inside_frequency_cap"}'` | `DEST_RULE_FREQUENCY_CAP`; the second post is rescheduled and the first is deleted. |
| Promotion on no-promo destination | `curl.exe -X POST http://localhost:8000/api/v1/selftest -H "Idempotency-Key: review-promotion" -H "Content-Type: application/json" --data-raw '{"case":"promotion_to_no_promo_destination"}'` | `DEST_RULE_VIOLATION`; the promotional post is blocked. |
| Renamed response field | `curl.exe -X POST http://localhost:8000/api/v1/selftest -H "Idempotency-Key: review-schema" -H "Content-Type: application/json" --data-raw '{"case":"renamed_field_demotes_destination"}'` | `SCHEMA_DRIFT`; certification detects drift, cleans up, and restores the destination's prior demotion state. |
| Partner permission revoked | `curl.exe -X POST http://localhost:8000/api/v1/selftest -H "Idempotency-Key: review-revoked" -H "Content-Type: application/json" --data-raw '{"case":"partner_revokes_permission"}'` | `CONNECTION_AUTH_EXPIRED`; publishing stops. |
| Non-English mismatch | `curl.exe -X POST http://localhost:8000/api/v1/selftest -H "Idempotency-Key: review-language" -H "Content-Type: application/json" --data-raw '{"case":"non_english_community_mismatch"}'` | `DEST_RULE_VIOLATION`; the community-language mismatch is blocked. |
| AI disclosure | `curl.exe -X POST http://localhost:8000/api/v1/selftest -H "Idempotency-Key: review-disclosure" -H "Content-Type: application/json" --data-raw '{"case":"ai_disclosure_auto_appended"}'` | `AI_DISCLOSURE_APPENDED`; disclosure is added and the mock post is deleted. |
| Catalogue CSV | `curl.exe -X POST http://localhost:8000/api/v1/selftest -H "Idempotency-Key: review-catalogue" -H "Content-Type: application/json" --data-raw '{"case":"csv_duplicates_bad_urls_mixed_languages"}'` | `CATALOGUE_IMPORT_COMPLETED`; real importer reports the duplicate, bad URL, and English/Spanish languages. |

## Idempotency

Every `POST` whose path starts with `/api/v1` requires an `Idempotency-Key` header containing 1–255 printable ASCII characters. A repeat with the same key, method, path, and request content replays the stored status and body and adds `Idempotent-Replay: true`. Reusing the same key for different request content returns `409 IDEMPOTENCY_KEY_CONFLICT`. If the original request is still running, the duplicate waits up to `IDEMPOTENCY_WAIT_MS`, then returns retryable `409 IDEMPOTENCY_REQUEST_IN_PROGRESS` if it has not finished. Completed keys are retained for `IDEMPOTENCY_TTL_HOURS`; abandoned in-progress claims can be reclaimed after `IDEMPOTENCY_LOCK_TTL_SECONDS`. Connector publish accepts the standard `Idempotency-Key` header; a matching `idempotency_key` body value is also supported. Health routes and non-POST methods are excluded.

## Batch job runner

The batch runner accepts one JSON file or a directory. It submits each input with an
idempotency key, polls jobs, and writes one result per input plus `summary.json`.
Current sample inputs use `batch_publish`, which returns `JOB_TYPE_NOT_READY`; the CLI handles
and records those failures, but does not claim to publish a batch.

```powershell
New-Item -ItemType Directory -Force test-pack\outputs\batch
docker compose run --rm -v "${PWD}\test-pack\outputs\batch:/out" api npm run ix-batch -- `
  --input samples/batch --out /out --api http://api:8000
```

Add `--token "$API_TOKEN"` when authentication is enabled.

## Measurement

After the default API is running, `npm run measure` evaluates the checked-in rule cases,
reads the preserved real certification records and catalogue import record, and runs two
isolated local mock publications. One mock request deliberately times out after creating a
post; the same-key retry is checked for exactly one item, and both measured posts are deleted.
The command writes `evidence/metrics.json`. From Docker:

```powershell
New-Item -ItemType Directory -Force certification-pack
docker compose run --rm -v "${PWD}\certification-pack:/app/certification-pack" api `
  npm run measure -- --api http://api:8000
```

The command also writes sanitized copies and deletion confirmations under `certification-pack/`.
It does not rewrite any original certification or catalogue evidence.

## Connector contract

`POST /connector/v1/:key/:method` accepts `destination_ref` (the connector API base URL), `connection`, `rendition`, and `idempotency_key`. `destination_id` may be supplied instead to load a saved destination. Contract schemas intentionally accept additional properties so the request can evolve without changing the common envelope. Destination records use their `config.base_url`; connection values use `api_key` and `api_username`. The API key is only sent to the platform and is never persisted or returned.

### Assumed contract schemas

The Phase 4 request shapes are `rendition: { title, body, language?, is_promotional?, ai_generated?, canonical_url?, links?: string[], media?: { url, type }[] }`, `destination: { config: { base_url }, enabled? }`, and `connection: { api_key, api_username }`. Title and body are required by publish validation; unknown extra fields are accepted for forward compatibility.

The Discourse manifest is the source of destination limits and platform error mappings. Publishing validates the title/body against the manifest and uses a hidden `ix-ref` marker for recovery. The ledger distinguishes `in_flight`, `published`, `unknown`, and `failed`; after a network failure the next request searches by marker before attempting another create.

Each connector surface also declares accepted `media_types` as exact MIME types or prefixes
such as `image/*`. A saved destination may override that list with `config.media_types`.
Unsupported media is rejected before publishing with `DEST_SPEC_VIOLATION` and a field-level
reason. Discourse, Dev.to, and Ghost implement
`POST /connector/v1/{key}/fetch_metrics`, returning the shared counters
`views`, `likes`, `comments`, `shares`, `saves`, `watch_time_s`, and `clicks`. Unsupported
connectors keep the standard `CONNECTOR_NOT_IMPLEMENTED` response.

The MRSS connector publishes video and image items into a service-hosted RSS 2.0 feed.
Its `video` surface allows `video/mp4`, `video/webm`, `image/jpeg`, and `image/png`.
Read a destination feed at `GET /feeds/{destination_id}.xml`; XML text and attributes
are escaped by the feed renderer. Item guids are stable idempotency markers, so retrying
an ambiguous publish does not add a duplicate item. The connector supports publish,
status, and delete at level L2.

Slack destinations use `config.base_url` for the workspace API and `config.channel_id`
for the target channel. Configure `connection.bot_token`; publishing calls `chat.postMessage`,
status reads channel history, and delete calls `chat.delete`. The marker is stored in Slack
message metadata.

Hashnode destinations use `config.base_url` for the GraphQL endpoint and
`config.publication_id` for the publication. Configure `connection.api_key`; the connector
uses `publishPost`, `post`, `postBySlug` marker lookup, and `removePost`. Both connectors
support the shared publish, status, and delete contract and video/image MIME types declared
in their manifests. Their scenarios run only against the local simulation mocks.

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

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| NODE_ENV | development | Runtime environment |
| PORT | 8000 | HTTP listening port |
| HOST | 0.0.0.0 | HTTP listening host |
| LOG_LEVEL | info | Pino severity threshold |
| DATABASE_URL | required | PostgreSQL connection string |
| PUBLIC_BASE_URL | http://localhost:8000 | Public service URL |
| SIMULATION_MODE | true | Mount local mock platform endpoints |
| SEED_DEMO | false | Seed local demo destinations during API startup in simulation mode |
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
| STORAGE_DRIVER | s3 | Storage backend: local, mock, or s3 |
| STORAGE_DIR | ./data/storage | Directory used by local storage |
| S3_ENDPOINT | empty outside Compose | S3-compatible endpoint |
| S3_REGION | us-east-1 | S3 region |
| S3_BUCKET | incubrix | S3 bucket name |
| S3_ACCESS_KEY | empty outside Compose | S3 access key; local Compose default is for development only |
| S3_SECRET_KEY | empty outside Compose | S3 secret key; local Compose default is for development only |
| CERT_TEST_POST_TTL_MINUTES | 10 | Maximum lifetime of a certification test post |
| CERT_JANITOR_INTERVAL_SECONDS | 60 | Interval between certification cleanup sweeps |
| CERT_ALLOWED_HOSTS | localhost,127.0.0.1 | Comma-separated hosts allowed for certification posts |
| CONNECTORS_DISABLED | empty | Comma-separated connector keys disabled by configuration |
| JOBS_POLL_INTERVAL_MS | 1000 | In-process job worker polling interval |
| JOBS_MAX_ATTEMPTS | 3 | Maximum job attempts before terminal failure |
| JOBS_STALE_SECONDS | 300 | Age at which a running job is treated as stale |
| JOBS_CALLBACK_SECRET | development default | HMAC secret for outbound job callbacks |
| JOBS_CALLBACK_TIMEOUT_MS | 5000 | Outbound callback timeout |
| RATE_LIMIT_PER_MINUTE | 60 | Shared API rate limit per minute; mock routes are exempt |
| CONNECTIONS_FILE | /app/data/connections.json | Optional local connections JSON merged below environment overrides |
| CONNECTION_LEMMY_LOCAL | empty | Optional local Lemmy connection override |
| CONNECTION_GHOST_LOCAL | empty | Optional local Ghost connection override |
| LLM_PROVIDER | mock | Rules-capture adapter: mock, gemini, groq, or ollama |
| GEMINI_API_KEY | empty | Optional key when using Gemini rules capture |
| GROQ_API_KEY | empty | Optional key when using Groq rules capture |
| OLLAMA_BASE_URL | http://localhost:11434 | Ollama endpoint when selected |

## Error codes

| Group | Codes |
| --- | --- |
| Connector contract | DEST_SPEC_VIOLATION, DEST_RULE_FREQUENCY_CAP, CONNECTION_AUTH_EXPIRED, PLATFORM_RATE_LIMIT, PLATFORM_QUOTA_EXHAUSTED, PLATFORM_CONTENT_REJECTED, PLATFORM_UNAVAILABLE, CONNECTOR_DISABLED |
| Connector framework and rules | SCHEMA_DRIFT, DEST_RULE_VIOLATION, DESTINATION_DEMOTED, DESTINATION_DISABLED, CONNECTOR_NOT_IMPLEMENTED |
| Certification | CERT_HOST_NOT_ALLOWED, CERT_CONFIG_INVALID |
| Validation and HTTP | VALIDATION_ERROR, UNSUPPORTED_MEDIA_TYPE, PAYLOAD_TOO_LARGE, NOT_FOUND, UNAUTHORIZED, RATE_LIMITED, NOT_READY, INTERNAL_ERROR |
| Idempotency | IDEMPOTENCY_KEY_REQUIRED, IDEMPOTENCY_KEY_CONFLICT, IDEMPOTENCY_REQUEST_IN_PROGRESS |
| Jobs and catalogue | JOB_TYPE_UNKNOWN, JOB_TYPE_NOT_READY, DUPLICATE_DESTINATION |
| Rules proposals | RULES_PROPOSAL_NOT_FOUND, RULES_PROPOSAL_REJECTED |

Every error response uses `{ "error": { "code", "message", "retryable", "details" } }`.

## Live demo

- URL: https://incubrix-ps4-2ms6.onrender.com
- token: provided in the Submission Form
- Rate limit: 120/min
- Cold start: TODO(student): cold-start seconds; record the observed value before submission.

## Phases

- Phase 1 — DONE: Core connectors, real Lemmy/Ghost certification, mock parity, media validation, and metrics.
- Phase 2 — DONE: Output manifests, jobs, API rate limiting, and OpenAPI route parity.
- Phase 3 — PARTIAL: Integration proof and batch CLI are in place; `batch_publish` scenarios remain unavailable.
- Phase 4 — DONE: Idempotent simulation seeding and all 14 hidden-case selftests pass.
- Phase 5 — DONE: Tailoring, relevance scoring, and rules capture.
- Phase 6 — DONE: MRSS, Slack, and Hashnode connectors pass mock certification and contract tests.
- Phase 7 — DONE: Catalogue CSV import, error reports, mixed-language detection, and 1,000-row timing are verified.
- Phase 8 — PARTIAL: Metrics and documentation are recorded; student-only demo, screenshot, and form tasks remain.
