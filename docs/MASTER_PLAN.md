# MASTER PLAN: IncuBrix Assessment 4 (Long-Tail Destination Network)

Save this file as `docs/MASTER_PLAN.md`. It is the single source of truth. Deadline: **Sun 25 Oct 2026, 11:59 PM IST**.

## 0. How the agent must work (read first, every session)

1. Read `AGENTS.md`, `docs/PROGRESS.md`, `docs/CERTIFICATION_SPEC.md` and this file.
2. Find the **first work package (WP) not marked DONE** in `docs/PROGRESS.md`. Do only that WP, in its listed order.
3. Work in small steps. After each step run the Docker suite. Never leave the suite red. Never say "done" without pasting real output.
4. A step report is INVALID unless it shows (a) the Docker totals, higher than before when tests were required, (b) every test name the WP lists in verbose output.
5. If a WP cannot finish, write exactly which items remain in `docs/PROGRESS.md`, then stop. Do not describe a skeleton as done. Do not start the next WP.
6. Do not commit or push. After each WP print the exact git commands for the student.
7. Update `docs/PROGRESS.md` (real totals, DONE/PARTIAL per WP) and the roadmap in `AGENTS.md` after every WP.

Verify commands (always):
```
docker compose up --build -d
docker compose run --rm api npm test
docker compose run --rm api npm run lint
docker compose run --rm api npm run build
```

### Ground rules
- TypeScript on Node 22 (CommonJS output). New files are `.ts`. Existing `.js` files may stay `.js`; do not spend time converting them. Mixed is acceptable.
- Brief Appendix A is the contract. Language rule: Python 3.11+ or TypeScript (Node 20+). Stay TypeScript.
- Route -> handler -> service -> repository. Services throw `AppError`. Error envelope `{error:{code,message,retryable,details}}`.
- Readability: one statement per line, no line over 110 characters, no function over 40 lines, 2-3 line header comment on every new file. The student must explain every line live.
- No secrets in code, logs, responses, ledger, evidence or fixtures. Test secrets are obviously fake.
- Only new dependencies allowed: `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` (MinIO driver). Anything else: stop and explain. Free tools only: no paid APIs. LLM providers are free-tier or local and must sit behind an adapter whose default is `mock`.
- Every blocked, rescheduled, warned or auto-fixed action carries `code`, `message` and what the system did. Silent failure scores 0.
- Never post to real communities. Only local instances, mocks and agreed sandboxes.

## 1. Verified starting state (from the zip, Oct 22)

Built and working: config, error envelope, idempotency for `/api/v1` POSTs, destinations CRUD (matches Appendix A destination record), secret redaction, connector base class (error map, 429 backoff, 5-failure circuit breaker, strict response validation, `SCHEMA_DRIFT`), Discourse, webhook (HMAC) and assisted connectors, publish ledger with marker-based reconciliation, pure rules engine with 24+ fixtures, certification orchestrator (six steps, failure recording, demotion, one alert, recertification), TypeScript tooling (`tsc` clean, lint clean, 41 suites / 182 tests at last Docker run).

Known gaps to close:
- Certification: immediate cleanup after a failure, `cleanup_pending`, the 10-minute janitor, alerts tests, HTTP schemas and 404s, summary, secrets test. The S3c overlay (`immediateCleanup.js`, `commons/marker.js`, `delete_fails_*` mock scenarios) may be missing from the repo: check first.
- Not started: Lemmy, Ghost and Dev.to connectors; Lemmy and Ghost in compose; jobs; MinIO; output manifest; `openapi.yaml`; batch CLI; reviewer self-test and demo seeds; all five Advanced items; hosted demo; every deliverable document.
- Zip had no `.git` folder: student must confirm real commit history is pushed and the reviewer is added.

## 2. Score map (what actually earns marks)

| Part | Marks | Rule |
|---|---|---|
| Must-haves 1-9 | pass/fail | one failure means not selected |
| Core level | 15 | all must-haves plus six certified Core connectors with evidence |
| Advanced | 15 | all five items verified, and only if Core is verified |
| Integration Standard | 20 | 2 per point, ten points |
| Hidden tests on the live demo | 20 | 5 tests, silent failure is 0 |
| Live session | 20 | student must explain and change code live |

Screening needs 60/80. Core plus Integration alone cannot reach it, so Advanced is required. **Skip Outstanding.** Mark anything unfinished honestly as Partial/No: a false claim disqualifies.

## 3. Work packages

### WP0. Baseline (30 min)
- Confirm the Docker suite is green and record the totals in `docs/PROGRESS.md`.
- Check whether `src/modules/certification/services/immediateCleanup.js`, `src/modules/connectors/commons/marker.js` and the `delete_fails_once/twice` scenarios in `src/mocks/discourse.js` exist. If not, recreate them per `docs/CERTIFICATION_SPEC.md` section C and E.
- Fix `AGENTS.md` (codes live in `codes.ts`; roadmap points at this plan).
- Student: `git log --oneline`, push, add the reviewer as collaborator.

### WP1. Finish certification (spec sections C to F)
Implement what `docs/CERTIFICATION_SPEC.md` still lacks, in this order, tests first:
1. Immediate cleanup after failure; leftover post found by marker; `cleanup_pending` plus `cleanup_due_at`.
2. HTTP schemas and 404s: invalid uuid is 400, unknown run, evidence or alert is 404, runs query allows only `destination_id`, `status`, `limit`, `offset`.
3. Alerts list and acknowledge routes.
4. Janitor `runCleanup(deps)`, `POST /api/v1/certification/cleanup`, started from `server.ts` only (never `buildApp`), `unref`'d timer. This is the 10-minute rule of must-have 5.
5. `GET /api/v1/certification/summary` per connector.
6. Secrets test: fake `api_key`, `api_username`, `signing_secret` never appear in logs, responses, run rows, alert rows or evidence files.

Required test names (exact, in verbose output): the failure/cleanup/janitor/alerts/validation/secrets list in `docs/CERTIFICATION_SPEC.md` section F. Gate: at least 20 new tests.

### WP2. Integration Standard plumbing (10 marks, mostly mechanical)
Do these as separate steps, each with tests:

**2a. Jobs (point 3).** Table `jobs` (id, type, status `queued|running|succeeded|failed`, progress 0-100, result jsonb, error jsonb, callback_url, correlation_id, created/updated). In-process worker polling with `FOR UPDATE SKIP LOCKED`, started in `server.ts` only; tests drive it through an exported `runPending()`. `POST` returns `202 {job_id}`; `GET /api/v1/jobs/{job_id}` returns status, progress and result links. Optional `callback_url`: POST the result with `X-IncuBrix-Signature: sha256=<HMAC of "{timestamp}.{body}">` using `CALLBACK_SIGNING_SECRET`, reusing `webhook/sign`, three retries. Make these job-based: certify, selftest, catalogue import, batch. Certify keeps `?wait=true` for synchronous test use. Idempotency already replays the same 202 body for the same key. Tests: 202 shape, status transitions, replay returns the same job, signed callback verifies, failed job carries the error envelope.

**2b. Storage and MinIO (point 7).** `minio` service in compose with a bucket-init step. S3 driver behind the existing storage adapter (`STORAGE_DRIVER=s3|local`), presigned download links, local-disk fallback. Inputs accepted as upload or URL where relevant (catalogue CSV). Test the adapter contract against both drivers; the S3 test runs only when `S3_ENDPOINT` is set.

**2c. Output manifest (point 9).** `src/modules/manifest/build.ts`: providers and versions used, settings, seed, timings, cost estimate (0 with mocks), warnings, licence/rights info, `ai_generated` flag. Stored as a file; the job result links to it. Do **not** add fields to Appendix A connector responses; attach the manifest to job results and certification/self-test outputs. Test: every job result links a manifest with all required keys.

**2d. Logs and health (point 8).** JSON logs with timestamp, level, `job_id` (child logger inside the worker) and `correlation_id` (propagate from the request into the job row). `GET /health` and `GET /ready` (database and storage checked). Test: a job's log lines carry both ids.

**2e. `openapi.yaml` (point 2).** OpenAPI 3.1 handwritten, covering every route including the documented `/connector/v1/{key}/{method}` and the `/api/v1/connectors/...` alias. Test that diffs the running app's route list (use an `onRoute` collector) against the spec's paths and methods and fails on any mismatch.

**2f. Batch runner (point 10).** `scripts/ix-batch.ts` (add `"ix-batch"` script): reads a folder or file of JSON inputs, calls the API with idempotency keys, polls jobs, writes every result and its manifest to one output folder plus `summary.json`. Supply `samples/batch/` with at least 8 inputs including failures. Test it against an in-process server.

**2g. One-command start and test (point 1).** `docker compose up` works with no `.env`; `.env.example` lists every setting; `docker compose run --rm api npm test` runs unit, integration and one end-to-end test (compose-level or in-process full path) with no API keys.

Gate: all ten Integration Standard points have a test or a documented proof link.

### WP3. The three missing Core connectors (must-have 2 and 8)
**3a. Lemmy and Ghost bootstrap spike first, in a separate folder (biggest risk; start it in parallel with WP1).** Pin exact current image tags after reading the current official Lemmy and Ghost docs. Needs: Lemmy (+ postgres, + lemmy-ui only if the API needs it), Ghost (+ whatever database the current docs require), healthchecks, modest memory (`docker stats`), an idempotent bootstrap script that creates the Lemmy admin and an `incubrix-test` community and the Ghost owner plus a custom Integration Admin API key, writes credentials to a gitignored file or shared volume, never to console logs. A verify script proves create, read, delete for both (Lemmy delete is soft: say how "gone" is confirmed; Ghost: 404 after delete). Report versions, ports, RAM, time to ready, exact endpoints and payloads that worked, and anything manual.

**3b. Dev.to connector** (REST, `api-key` header, `POST /api/articles`, update with `published:false` to hide, mock with scenarios normal, timeout_after_success, renamed_field, rate_limit_long, expired_token, content_rejected, unavailable).
**3c. Lemmy connector** and **3d. Ghost connector** (Ghost Admin API uses a short-lived HS256 JWT built from the `id:secret` key, header `Authorization: Ghost <jwt>`), each with: manifest per Appendix A, strict response models, marker for reconciliation (Lemmy: marker in the post body; Ghost: a tag or slug derived from the idempotency key), error map, and a mock with the same fault scenarios so tests need no real instance.

For each connector: it joins the parametrised contract-compliance test, passes certification against its mock (and against the real local instance via a separate documented command), has `HARD CASE` timeout-retry-one-post and renamed-field-`SCHEMA_DRIFT` tests, and a secrets-not-logged test.

Compose: `docker compose up` starts api, postgres, minio, lemmy (+db), ghost (+db) and the bootstrap job. The api must not depend on Lemmy or Ghost being healthy to start. Document the RAM needed (about 6 GB Docker memory) and a `--profile`-free fallback: simulation mode works with only api, postgres and minio running.

Gate: six Core connectors certified in simulation, with evidence files; Lemmy and Ghost certified against the real local instances at least once with evidence saved.

### WP4. Hidden-test readiness (20 marks)
- **Demo seed destinations** (config only, loaded by a seed command and on first boot when `SEED_DEMO=true`): `sim-timeout`, `sim-429`, `sim-expired-token`, `sim-renamed-field`, `sim-no-promo`, `sim-weekly-cap`, `sim-needs-disclosure`, `sim-revoked-partner`, `sim-non-english`, `sim-media-rejected`.
- **`POST /api/v1/selftest`** job: runs every hard case from the brief and returns a pass/fail report with the reason code each produced. Hard cases: timeout then retry; 429 with reset; expired token; content rejected; title/body too long; media not accepted; second post inside cap; promo to no-promo; field rename demotes; CSV with duplicates, bad URLs and mixed languages; partner revokes permission; non-English community; AI disclosure required.
- Ensure `validate` rejects media types a destination does not accept with `DEST_SPEC_VIOLATION` and field-level reasons; add the test.
- **Reviewer guide** in README: one `curl` per hard case, expected result in one line each.
- Demo rate limit (in-memory limiter, configurable, `RATE_LIMITED` envelope) and optional demo bearer token (`API_TOKEN`).

### WP5. Advanced level: all five items (all-or-nothing, 15 marks)
Cheapest correct version of each. Order: tailoring, relevance, three connectors, rules capture, catalogue import.

1. **Tailoring** (`src/modules/tailoring`, pure functions, `POST /api/v1/tailor`): discussion-first framing for forums; canonical URL for articles; truncation at a word boundary; hashtag and mention style per platform; returns the tailored rendition plus a `changes` list.
2. **Relevance 1-5** against AI, video, marketing, SaaS, creators and founders: deterministic tag and keyword overlap with a generated one-line explanation, stored in `relevance_score` and `relevance_reason`. Optional LLM refinement behind the adapter.
3. **Three more connectors:** MRSS video feed (tier feed, L2: build the XML yourself, `GET /feeds/{destination}.xml`), Slack (bot token, `chat.postMessage` and `chat.delete`, mock) and Hashnode (GraphQL, mock). Each follows WP3 rules.
4. **Rules capture:** `src/llm` adapter with `mock | gemini | groq | ollama` chosen by env, default mock (deterministic extraction so tests need no key). `POST /api/v1/destinations/{id}/rules/capture` stores a **pending** proposal; the engine ignores it until `POST .../rules/confirm`. Test that unconfirmed proposals never affect decisions.
5. **Catalogue import:** `POST /api/v1/catalogue/import` (CSV upload or URL) runs as a job: parse, normalise URL, dedupe on normalised URL plus platform, validate URLs, reachability check (concurrency about 50, short timeout), enrich (e.g. member count from the mock), detect language, score relevance, write destination rows, and produce a row-by-row error CSV. Generate a 1,000-row fixture (`scripts/gen-catalogue.ts`) containing duplicates, bad URLs and mixed languages, **time the import and record it** (target under 5 minutes). Test the error report content.

Gate: each item has tests and one evidence file; the 1,000-row time is recorded.

### WP6. Hosted demo and measurements
- Deploy with a free host (verify current free-tier terms): e.g. a Docker web service plus a free Postgres. Simulation mode only on the host (Lemmy and Ghost stay local; say so honestly). Record the cold-start time, set the rate limit and a bearer token.
- `scripts/measure.ts` produces the Metrics tab numbers: certifications per connector and time per run; publish success rate in simulation; duplicates under retry (must be 0); rule violations caught vs missed on the fixture set (missed must be 0); catalogue rows, duplicates, errors, time for 1,000 rows; cost per 1,000 publications.
- Run the whole README from a **clean clone with no `.env`** on another folder, and fix whatever breaks. This test is mandatory.

### WP7. Deliverables (write honestly)
`README.md` (what it does, architecture diagram, setup in under 10 commands, tests, batch runner, all settings, error codes, Reviewer Guide), `openapi.yaml`, `REPORT.md` (2-4 pages: approaches considered and why, what works and what does not, measured numbers, cost per unit, next steps), `SOURCES.md` (every library, image, model and dataset with licence), `AI_USE.md` (every AI tool used and for what), `test-pack/` (inputs, outputs including failures, logs, index mapping each claim to a file), `certification-pack/` (per destination: run record, live URL or API response, screenshot, deletion confirmation), `catalogue/` (CSVs and import reports). Keep failed attempts in the test pack.

### WP8. Student-only tasks
- Fill the Submission Form tab by tab: Yes/Partial/No with a working link to proof for every claim. Test names from this plan map one-to-one to rows.
- Record the demo video (at most 8 minutes, unedited): one clean run, one failure and how it is handled (timeout-retry-one-post), tests running, one design decision in code.
- Practise the live session: trace one field from request to final file; explain the idempotency service, the ledger reconciliation, the rules engine order and the connector base class; practise adding a rule with a test first.
- Confirm every link works and the reviewer has repo access before submitting.

## 4. Schedule (IST)

| When | Do |
|---|---|
| Thu night | WP0, start WP1, run the Lemmy/Ghost spike in a second tool |
| Fri | Finish WP1, WP2a to 2d, WP3b (Dev.to), start 3c and 3d from spike results |
| Sat | WP2e to 2g, WP3 finish, WP4, WP5 (tailoring, relevance, MRSS, rules capture, catalogue import) |
| Sun | WP6 deploy and measure, WP7 docs, WP8 video and form, submit by early evening with no new features |

## 5. If time runs short (cut in this order)
1. Hashnode, then Slack (keep MRSS). Advanced then fails, so mark it honestly Partial.
2. Real Lemmy/Ghost certification evidence (keep the connectors working against mocks).
3. Never cut: must-haves 1-9, the clean-clone test, the self-test endpoint, honest form marking.

## 6. Definition of done
- [ ] Docker suite green, lint and build clean, totals recorded
- [ ] Six Core connectors certified with evidence; all error codes mapped
- [ ] Rules, idempotent retry, 429 backoff, demotion and cleanup verified by named `HARD CASE` tests
- [ ] Ten Integration Standard points proven
- [ ] Five Advanced items with evidence and the 1,000-row timing
- [ ] Hosted demo live, rate limited, cold start recorded
- [ ] Clean-clone run passes without `.env`
- [ ] README, REPORT, SOURCES, AI_USE, test pack, certification pack, form, video
