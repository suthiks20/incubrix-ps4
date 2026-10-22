# Progress

## Current step

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

WP2a: Jobs.
