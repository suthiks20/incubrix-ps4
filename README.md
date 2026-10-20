# IncuBrix Long-Tail Destination Network

Phase 1 provides the Node.js/Fastify foundation for a connector service that will publish content to community destinations in later phases.

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

## Error codes

| Group | Codes |
| --- | --- |
| Connector | DEST_SPEC_VIOLATION, DEST_RULE_FREQUENCY_CAP, CONNECTION_AUTH_EXPIRED, PLATFORM_RATE_LIMIT, PLATFORM_QUOTA_EXHAUSTED, PLATFORM_CONTENT_REJECTED, PLATFORM_UNAVAILABLE, CONNECTOR_DISABLED |
| Platform | VALIDATION_ERROR, NOT_FOUND, UNAUTHORIZED, IDEMPOTENCY_KEY_REQUIRED, IDEMPOTENCY_KEY_CONFLICT, RATE_LIMITED, NOT_READY, INTERNAL_ERROR, CONNECTOR_NOT_IMPLEMENTED, DESTINATION_DISABLED |

## Phases

- Phase 1 — done: project skeleton, health/readiness, configuration, errors, logging, tests, and Docker.
- Phases 2–6 — pending.
