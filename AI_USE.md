# AI use disclosure

## AI coding tools used

- **GitHub Copilot (agent mode in VS Code):** my main coding assistant. I used it to generate most
  of the first versions of the code: connectors, mock servers, the rules engine, certification,
  jobs, the catalogue importer, tests, scripts, and project documentation. I gave it written
  prompts per phase and reviewed what it produced against the brief.
- **Claude (chat assistant, claude.ai):** used outside the code editor to help me read the
  assessment brief against my repository, write prompts for Copilot, plan debugging steps,
  and prepare the demo video script and the Submission Form notes. Claude did not write
  files in my repository directly.

## What I did myself

- I ran the Docker stack, the full test suite, the self-test and the demo commands on my
  own machine, and I recorded the demo video myself.
- Copilot's output did not always work first time. I fixed some of the errors manually
  (for example failing tests and environment problems) and re-ran the tests until they passed.
- I reviewed the generated code and documentation and I can explain how it works.
  Generated code was kept where it was correct, edited where it was not, and removed where
  it was wrong or unnecessary.

## AI in the running product

- The service does not call a paid model or an external AI API by default. Rules capture
  uses an adapter selected by `LLM_PROVIDER`, which defaults to a deterministic `mock`
  provider so tests run with no API keys. No API keys or paid model services were used
  to produce the results in this submission.
- The measurement command defaults to deterministic local rules and local platform mocks.

## What I did myself

- I ran the Docker stack, the full test suite, the self-test and the demo commands on my
  own machine, and I recorded the demo video myself.
- Copilot's output did not always work first time. I fixed many of the errors by hand,
  mostly failing tests and problems that appeared when re-running things, such as test data
  left over from an earlier run (reused rows and reused keys). I did not keep a complete log
  of every manual fix. The git history and `docs/PROGRESS.md` record the main ones.
- I reviewed the generated code and documentation and I can explain how it works.
  Generated code was kept where it was correct, edited where it was not, and removed where
  it was wrong or unnecessary.
