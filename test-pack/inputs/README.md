# Test inputs

Canonical hard-case inputs are kept in the project fixtures and linked here:

- Connector scenarios: `../../samples/batch/`
- Rules: `../../tests/fixtures/rule-cases.json`
- Catalogue rows: `../../samples/catalogue/catalogue-1000.csv`
- Selftest request: `POST /api/v1/selftest` with an `Idempotency-Key` header, documented in
  `../../README.md`.

Platform scenarios run against local mocks or local Lemmy/Ghost instances.
