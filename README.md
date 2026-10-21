# IncuBrix Long-Tail Destination Network

The IncuBrix Long-Tail Destination Network is a Node.js/Fastify connector service foundation for publishing content to community destinations. Phase 2 adds database migrations, optional bearer authentication, and a destination catalogue API.

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

```bash
copy .env.example .env
docker compose up --build
docker compose run --rm api npm test
docker compose run --rm api npm run lint
```

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

Every `POST` whose path starts with `/api/v1` requires an `Idempotency-Key` header containing 1–255 printable ASCII characters. A repeat with the same key, method, path, and request content replays the stored status and body and adds `Idempotent-Replay: true`. Reusing the same key for different request content returns `409 IDEMPOTENCY_KEY_CONFLICT`. If the original request is still running, the duplicate waits up to `IDEMPOTENCY_WAIT_MS`, then returns retryable `409 IDEMPOTENCY_REQUEST_IN_PROGRESS` if it has not finished. Completed keys are retained for `IDEMPOTENCY_TTL_HOURS`; abandoned in-progress claims can be reclaimed after `IDEMPOTENCY_LOCK_TTL_SECONDS`. `/connector/v1` is excluded because its connector contract carries `idempotency_key` in the JSON body, to be handled by the connector runtime later. Health routes and non-POST methods are also excluded.

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

## Error codes

| Group | Codes |
| --- | --- |
| Connector | DEST_SPEC_VIOLATION, DEST_RULE_FREQUENCY_CAP, CONNECTION_AUTH_EXPIRED, PLATFORM_RATE_LIMIT, PLATFORM_QUOTA_EXHAUSTED, PLATFORM_CONTENT_REJECTED, PLATFORM_UNAVAILABLE, CONNECTOR_DISABLED |
| Platform | VALIDATION_ERROR, UNSUPPORTED_MEDIA_TYPE, PAYLOAD_TOO_LARGE, NOT_FOUND, UNAUTHORIZED, IDEMPOTENCY_KEY_REQUIRED, IDEMPOTENCY_KEY_CONFLICT, IDEMPOTENCY_REQUEST_IN_PROGRESS, RATE_LIMITED, NOT_READY, INTERNAL_ERROR, CONNECTOR_NOT_IMPLEMENTED, DESTINATION_DISABLED |
| Destinations | DUPLICATE_DESTINATION |

## Phases


- Phase 1 — done: project skeleton, health/readiness, configuration, errors, logging, tests, and Docker.
- Phase 2 — done: migrations, optional bearer authentication, and destinations API.
- Phase 3 - done: idempotency claims, response replay, and concurrent duplicate protection.
- Phase 3.5 cleanup - done: client error envelopes, server-managed destination fields, and config cleanup.
- Phases 4–6 — pending.
