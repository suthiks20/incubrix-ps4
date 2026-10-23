# Progress

## Current step

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

WP2b: Storage and output manifests.
