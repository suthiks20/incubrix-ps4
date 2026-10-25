# Test pack index

This pack links reviewer claims to reproducible inputs, actual outputs, and logs.
It preserves both passing gate output and observed failed attempts; no credentials are included.
selftest-*.json were re-encoded from UTF-16 to UTF-8; content unchanged.

| Claim | Input | Output or log | Reproduction |
|---|---|---|---|
| Policy engine catches fixture violations | `../tests/fixtures/rule-cases.json` | `../evidence/metrics.json` | `npm run measure -- --api http://127.0.0.1:8000` |
| Connector timeout retry creates one post | `../samples/connector/discourse-timeout.json` | `../evidence/metrics.json` | Run `npm run measure` against the local Docker API |
| No-`.env` clean-clone startup and readiness | `../docker-compose.yml` | `logs/clean-clone-up.txt` | `docker compose up --build -d`; `/ready` returned DB and storage `ok` |
| Clean-clone Docker test gate | Project test tree | Phase 9 totals in `../docs/PROGRESS.md` | `docker compose build api`, then test, lint and build commands from `../README.md`; 72 suites / 400 tests passed |
| Seeded clean-clone selftest | README selftest request and seeded mock catalogue | `outputs/selftest/phase9-report.json`, `outputs/selftest/phase9-manifest.json` | Default simulation seeding followed by POST `/api/v1/selftest`; 14/14 passed |
| Initial unseeded selftest failure | Selftest request before the documented seed step | `outputs/selftest/unseeded/`, `logs/clean-clone-selftest-unseeded.txt` | Preserved setup failure; rerun after seeding passed |
| Batch runner evaluates every sample | `../samples/batch/` | `outputs/batch/summary.json` and one result per input | See `../README.md`; clean-clone run reports 8/8 expected outcomes and zero failures |
| Earlier failed regression and repair | Discourse content-rejection case | `outputs/phase6-parser-regression.md` | Run `tests/integration/connectors.test.js` in Docker |
| Real platform certification | Local Lemmy and Ghost run records | `../certification-pack/` | See the real records in `../evidence/` |

## Contents

- `inputs/README.md` identifies canonical fixtures without copying them.
- `outputs/` contains passing Phase 9 batch results and summary, the seeded selftest report and manifest, the preserved
  unseeded setup failure, and the prior regression record.
- `logs/` preserves the earlier clean-clone startup, test, lint, build, seed, batch and selftest
  transcripts, including the initial batch-not-ready attempt. Final Phase 9 gate totals and
  successful batch/selftest results are recorded in `../docs/PROGRESS.md` and `outputs/`.
- `../catalogue/` contains the 1,000-row input and actual import report artifacts.
