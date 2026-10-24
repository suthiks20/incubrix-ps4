# Preserved failed attempt: shared error parser

During the Phase 6 full test run, the suite had one failure:

- Test: `HARD CASE content rejected returns PLATFORM_CONTENT_REJECTED with the platform message in details`
- Expected: `error.details.platform_message` was `Title is too short`.
- Observed: the value was missing because the Discourse mock supplies `errors` as strings.
- First-run totals: 1 failed suite, 70 passed; 1 failed test, 391 passed.

The shared parser was corrected to accept both string and object entries in platform error
arrays. The targeted regression and subsequent full gate passed. This is a preserved failed
attempt, not a current failure.
