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

## Idempotency

Every `POST` whose path starts with `/api/v1` requires an `Idempotency-Key` header containing 1–255 printable ASCII characters. A repeat with the same key, method, path, and request content replays the stored status and body and adds `Idempotent-Replay: true`. Reusing the same key for different request content returns `409 IDEMPOTENCY_KEY_CONFLICT`. If the original request is still running, the duplicate waits up to `IDEMPOTENCY_WAIT_MS`, then returns retryable `409 IDEMPOTENCY_REQUEST_IN_PROGRESS` if it has not finished. Completed keys are retained for `IDEMPOTENCY_TTL_HOURS`; abandoned in-progress claims can be reclaimed after `IDEMPOTENCY_LOCK_TTL_SECONDS`. `/connector/v1` is excluded because its connector contract carries `idempotency_key` in the JSON body, to be handled by the connector runtime later. Health routes and non-POST methods are also excluded.

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
| STORAGE_DIR | ./data/storage | Directory for local certification evidence |
| CERT_TEST_POST_TTL_MINUTES | 10 | Maximum lifetime of a certification test post |
| CERT_JANITOR_INTERVAL_SECONDS | 60 | Future certification cleanup interval in seconds |
| CERT_ALLOWED_HOSTS | localhost,127.0.0.1 | Hosts allowed to receive certification posts |
| CONNECTORS_DISABLED | empty | Comma-separated connector keys disabled by configuration |

## Error codes

| Group | Codes |
| --- | --- |
| Connector | DEST_SPEC_VIOLATION, DEST_RULE_FREQUENCY_CAP, CONNECTION_AUTH_EXPIRED, PLATFORM_RATE_LIMIT, PLATFORM_QUOTA_EXHAUSTED, PLATFORM_CONTENT_REJECTED, PLATFORM_UNAVAILABLE, CONNECTOR_DISABLED |
| Connector framework extensions | SCHEMA_DRIFT, DEST_RULE_VIOLATION, DESTINATION_DEMOTED |
| Certification extensions | CERT_HOST_NOT_ALLOWED, CERT_CONFIG_INVALID |
| Platform | VALIDATION_ERROR, UNSUPPORTED_MEDIA_TYPE, PAYLOAD_TOO_LARGE, NOT_FOUND, UNAUTHORIZED, IDEMPOTENCY_KEY_REQUIRED, IDEMPOTENCY_KEY_CONFLICT, IDEMPOTENCY_REQUEST_IN_PROGRESS, RATE_LIMITED, NOT_READY, INTERNAL_ERROR, CONNECTOR_NOT_IMPLEMENTED, DESTINATION_DISABLED |
| Destinations | DUPLICATE_DESTINATION |

## Phases


- Phase 1 — done: project skeleton, health/readiness, configuration, errors, logging, tests, and Docker.
- Phase 2 — done: migrations, optional bearer authentication, and destinations API.
- Phase 3 - done: idempotency claims, response replay, and concurrent duplicate protection.
- Phase 3.5 cleanup - done: client error envelopes, server-managed destination fields, and config cleanup.
- Phase 4 - done: connector framework, Discourse, simulator, and publish ledger.
- Phase 5 - done: rules engine, webhook, assisted connector, race protections, and simulation coverage.
