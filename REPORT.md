# IncuBrix Assessment 4: Long-Tail Destination Network

## Executive summary

This repository contains a containerized Fastify service for publishing to configured
long-tail destinations. It implements nine connector entries: Discourse, Lemmy, Dev.to,
Ghost, signed webhook, assisted, MRSS, Slack, and Hashnode. Rules and destination-specific
format checks are evaluated before automated publishing; a PostgreSQL ledger and platform
markers reconcile ambiguous timeouts. Jobs store manifests and output files through an
S3-compatible storage adapter.

Phase 8 measurements are in [`evidence/metrics.json`](./evidence/metrics.json). The saved
real certification records show one passing Lemmy L3 run (785 ms) and one passing Ghost L3
run (1,201 ms). No preserved real run record was found for the other seven connectors, so
their real-run counts are zero rather than inferred from mock tests. In local simulation,
100 disposable publishes across five publish-capable Core connectors all succeeded, followed
by 20 forced timeout-and-retry operations; all retries succeeded with zero duplicate posts.
The 24-case rules fixture had 13 expected target violations and caught all 13, with zero
missed. The 1,000-row catalogue import processed 880 rows, reported 100 duplicates and
120 errors, and completed in 2.626 seconds.

## Approaches considered

### Catalogue configuration rather than destination-specific code

The service uses connector manifests and a destination catalogue row. This keeps policy,
instance URL, platform key, language, and other destination facts in configuration instead
of requiring a connector class for each community. It makes the one-connector-to-many-
destinations model straightforward to review and lets the catalogue importer use the same
destination schema.

### Durable markers and idempotency instead of blind retries

A timeout is ambiguous: the platform may have accepted a post even if the API did not receive
the response. The publisher records a ledger claim and embeds or stores a marker supported by
each connector. A retry checks that marker before creating another post. The measured
Discourse timeout case observed exactly one item after retry. The publish lock is in-process;
multiple API replicas would need a PostgreSQL advisory lock or equivalent distributed lock.

### Deterministic rules before optional language models

Frequency caps, self-promotion, links, AI disclosure, and language checks use a pure,
deterministic rules engine. The default LLM adapter is `mock`; optional Gemini, Groq, or
Ollama integrations are isolated behind the adapter. This keeps core publishing tests
reproducible and avoids a model call being treated as the authority for hard policy.
Rules capture creates a pending proposal; a human confirmation is required before it can
affect decisions.

### Small custom CSV and XML handling

Catalogue CSV parsing and the MRSS XML renderer are implemented without new parsing
dependencies. The CSV parser handles quoting, embedded commas, and UTF-8; the MRSS builder
escapes XML-sensitive characters in text and attributes. Their contract and edge cases are
covered by focused tests. This limits dependency and licence surface, at the cost of keeping
the parsers small and explicitly tested.

## What works

- The default Docker stack includes API, PostgreSQL, SeaweedFS, local Lemmy and Ghost, and
  bootstrap. No `.env` is required for local defaults.
- Destination, job, rules, tailoring, catalogue-import, certification, health, and connector
  APIs have route schemas and OpenAPI parity tests.
- The six Core connector types include Discourse, Lemmy, Dev.to, Ghost, signed webhook, and
  assisted. Mock certification tests cover Discourse, Dev.to, webhook, and assisted; saved
  real local-instance evidence covers Lemmy and Ghost.
- MRSS, Slack, and Hashnode have simulation mocks, timeout reconciliation, schema-drift
  checks, secret-redaction checks, and mock certification tests.
- The selftest job executes hidden-case scenarios and cleans its test posts. The catalogue
  importer reports invalid and duplicate rows and stores its error CSV.
- The Phase 9 Docker verification passed twice consecutively at 72 suites and 400 tests, with
  lint and build clean. A separate no-`.env` clone also passed the same gate; its seeded
  selftest passed all 14 cases and downloaded its report and manifest, and its batch runner
  matched all eight expected outcomes. The verification is recorded in
  [`docs/PROGRESS.md`](./docs/PROGRESS.md) and the clean-clone outputs in [`test-pack/`](./test-pack/).

## Measured results

| Measurement | Result | Evidence and interpretation |
|---|---:|---|
| Preserved real Lemmy certification | 1 passed; 785 ms | L3 run record and deletion confirmation |
| Preserved real Ghost certification | 1 passed; 1,201 ms | L3 run record and deletion confirmation |
| Other connectors' real certifications | 0 saved records | Mock certification tests are not counted as real runs |
| Disposable simulated Core publishes | 100 / 100 (100%); 20 each across Discourse, Lemmy, Dev.to, Ghost and webhook | Every successfully created post was deleted and status-verified |
| Forced timeout retries | 20 / 20 succeeded; 0 failures | Same-key marker reconciliation was exercised on all five publish-capable Core connectors |
| Duplicate posts under retry | 0 | Checked after each forced retry; all 20 retry posts were deleted and verified gone |
| Rule fixture | 24 cases; 13/13 expected target violations caught; 0 missed | Frequency cap 4/4, no-promo 3/3, link policy 3/3, AI disclosure 3/3 |
| Catalogue import | 1,000 rows; 880 imported; 100 duplicates; 120 errors; 2.626 s | Existing real import record; not rewritten by Phase 8 |
| Cost per 1,000 mock publications | $0 API usage | Excludes host compute, storage, network, and operational cost |

These numbers are not a production load test. The 100 simulated publishes are disposable
local-mock operations, and the certification timing sample contains only two saved real run
records. The 1,000-row timing comes from the catalogue integration test running the real API
route and worker, not from the hosted demo. See the JSON artifact for exact connector counts
and source files.

## What does not work or is not claimed

- Real destination reachability is mocked in simulation. Simulation success is not evidence
  that an arbitrary community URL is reachable or accepts a post.
- The Render demo does not include Lemmy or Ghost; those platforms are local Docker services.
  The demo URL and stated 120/min rate limit are supplied submission details. After idle,
  the first `/ready` request took 22.7 seconds (HTTP 200); the next request took 0.3 seconds.
- The Compose stack uses persistent Docker volumes locally. The hosted demo's filesystem may
  be ephemeral; production artifacts must use durable S3-compatible storage.
- Lemmy's delete API is a soft delete. The certification pack records the API deletion
  confirmation; it does not claim physical erasure from Lemmy's database.
- `batch_publish` is available for seeded simulation destinations. Its items use the shared
  rules and connector path, report expected outcomes, clean up created posts, and expose report
  and manifest links. It is not a real-platform bulk publishing feature.
- The preserved real certification evidence only covers Lemmy and Ghost. Other connectors
  have mock certification coverage, not independent real-platform runs.
- Outstanding recommender precision, 30-day recertification scheduling, and a real
  150-destination catalogue are not implemented. The form map records these accurately.

## Cost and next steps

Mock APIs incur $0 API charges per 1,000 publications; this is not a total cost-of-ownership
estimate. Include hosting, PostgreSQL, object storage, bandwidth, monitoring, and backup costs
when choosing a production plan.

Before submission, the student should enter the links in the Submission Form, verify
reviewer repository access, and capture the remaining connector certification screenshots
without credentials.
