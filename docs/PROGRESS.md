# Progress

## Current step

WP1 Step 1 - DONE (22 Oct 2026). Failed certification runs now make one immediate cleanup attempt, recover a
leftover post by its opaque marker when publish did not return an id, and persist either `failed` or
`cleanup_pending` with `cleanup_due_at`. Docker verified: 45 suites / 191 tests, lint clean, build clean.

WP0 Baseline - DONE (22 Oct 2026). Added the certification marker helper, immediate-cleanup helper, and local
Discourse `delete_fails_once` / `delete_fails_twice` scenarios with `delete_attempts`.

T2 shared-layer conversion and T1 TypeScript tooling are done and Docker-verified.

## Next

WP1 Step 2: HTTP schemas, 404s, alerts, and `CERT_CONFIG_INVALID`.
