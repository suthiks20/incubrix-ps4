RULES for every work package (read before starting)
- TypeScript, Node 22, CommonJS output. New files are .ts (mocks may be .js). Existing .js stays.
- Tests first, with the exact test names given. Real Postgres. Every error assertion matches
  {error:{code,message,retryable,details}}. Never weaken, skip or delete a test.
- Do not change working behaviour of existing connectors, rules, ledger, idempotency, certification,
  destinations or jobs unless a test proves a real bug (fix the root cause and say so).
- Readability (I explain every line live): one statement per line, no line over 110 chars, no function
  over 40 lines, 2-3 line header comment on every new file, layering route -> handler -> service ->
  repository. Do NOT copy the one-line style of connectors/discourse/index.ts; copy only its structure.
- No new dependencies unless the prompt names them. No secrets, no real communities, mocks and local only.
- Every blocked/rescheduled/warned/auto-fixed action returns code, message and what the system did.
- New settings go into src/config, .env.example, docker-compose.yml (${NAME:-default}) and the README
  settings table. README gets a short section per feature with Windows Command Prompt curl examples
  that include an Idempotency-Key.
- After each checkpoint run in Docker and read the real output: docker compose up --build -d,
  docker compose run --rm api npm test, npm run lint, npm run build. Red = fix the root cause.
- Write "<package> DONE" (or exactly what remains, marked PARTIAL) with real totals in docs/PROGRESS.md.
  Never claim success without pasted output. Do not commit or push; print the git commands for me.
- If you cannot finish: record what remains in PROGRESS.md, print the resume line, and stop.
