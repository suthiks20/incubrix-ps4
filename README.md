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
curl.exe -X POST http://localhost:8000/api/v1/destinations -H "Content-Type: application/json" --data-binary "@samples\destinations\discourse-forum-a.json"
```

If authentication is enabled, add `-H "Authorization: Bearer YOUR_API_TOKEN"` to the command. Posting the same sample again returns `409 DUPLICATE_DESTINATION`.

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

## Error codes

| Group | Codes |
| --- | --- |
| Connector | DEST_SPEC_VIOLATION, DEST_RULE_FREQUENCY_CAP, CONNECTION_AUTH_EXPIRED, PLATFORM_RATE_LIMIT, PLATFORM_QUOTA_EXHAUSTED, PLATFORM_CONTENT_REJECTED, PLATFORM_UNAVAILABLE, CONNECTOR_DISABLED |
| Platform | VALIDATION_ERROR, NOT_FOUND, UNAUTHORIZED, IDEMPOTENCY_KEY_REQUIRED, IDEMPOTENCY_KEY_CONFLICT, RATE_LIMITED, NOT_READY, INTERNAL_ERROR, CONNECTOR_NOT_IMPLEMENTED, DESTINATION_DISABLED |
| Destinations | DUPLICATE_DESTINATION |

## Phases

- Phase 1 — done: project skeleton, health/readiness, configuration, errors, logging, tests, and Docker.
- Phase 2 — done: migrations, optional bearer authentication, and destinations API.
- Phases 3–6 — pending.
