# Test pack index

This pack links reviewer claims to reproducible inputs, actual outputs, and logs.
It preserves both passing gate output and observed failed attempts; no credentials are included.

| Claim | Input | Output or log | Reproduction |
|---|---|---|---|
| Policy engine catches fixture violations | `../tests/fixtures/rule-cases.json` | `../evidence/metrics.json` | `npm run measure -- --api http://127.0.0.1:8000` |
| Connector timeout retry creates one post | `../samples/connector/discourse-timeout.json` | `../evidence/metrics.json` | Run `npm run measure` against the local Docker API |
| No-`.env` clean-clone startup and readiness | `../docker-compose.yml` | `logs/clean-clone-up.txt` | `docker compose up --build -d`; `/ready` returned DB and storage `ok` |
| Clean-clone Docker test gate | Project test tree | `logs/clean-clone-build.txt`, `logs/clean-clone-tests.txt`, `logs/clean-clone-lint.txt`, `logs/clean-clone-build-script.txt` | `docker compose build api`, then test, lint and build commands from `../README.md` |
| Seeded clean-clone selftest | README selftest request and seeded mock catalogue | `outputs/selftest/report.json`, `outputs/selftest/manifest.json`, `logs/clean-clone-seed.txt`, `logs/clean-clone-selftest-seeded.txt` | `docker compose run --rm api npm run seed`, then POST `/api/v1/selftest`; 14/14 passed |
| Initial unseeded selftest failure | Selftest request before the documented seed step | `outputs/selftest/unseeded/`, `logs/clean-clone-selftest-unseeded.txt` | Preserved setup failure; rerun after seeding passed |
| Batch runner records each unsupported sample | `../samples/batch/` | `outputs/batch/`, `logs/clean-clone-ix-batch.txt` | See `../README.md`; all eight results are `JOB_TYPE_NOT_READY` because `batch_publish` is unavailable |
| Earlier failed regression and repair | Discourse content-rejection case | `outputs/phase6-parser-regression.md` | Run `tests/integration/connectors.test.js` in Docker |
| Real platform certification | Local Lemmy and Ghost run records | `../certification-pack/` | See the real records in `../evidence/` |

## Contents

- `inputs/README.md` identifies canonical fixtures without copying them.
- `outputs/` contains batch results, the seeded selftest report and manifest, the preserved
  unseeded setup failure, and the prior regression record.
- `logs/` contains actual clean-clone startup, test, lint, build, seed, batch and selftest output.
- `../catalogue/` contains the 1,000-row input and actual import report artifacts.
