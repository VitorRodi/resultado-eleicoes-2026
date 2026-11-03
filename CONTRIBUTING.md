# Contributing

## Start with the project context

- [README.md](README.md)
- [AGENTS.md](AGENTS.md)

Include election/year/round, office, UF, municipality, source URL and source timestamp when applicable. Distinguish missing, partial, stale and official final data. Use synthetic fixtures for reproducible cases.

## Issues and pull requests

Search existing issues and PRs before opening one. Use the maintenance form for documentation, test or tooling work, and include the concrete problem, evidence, scope and verifiable acceptance criteria. Keep one coherent change per branch/PR.

Describe the final result and link the issue with `Closes #<number>` only when all acceptance criteria are met; use `Refs #<number>` for partial work. GitHub closes the linked issue when the PR merges into the default branch. Do not create empty changes just to generate activity.

## Verification

Use `npm ci`, `npm test`, `npm run lint`, `npm run typecheck` and `npm run build`. For data changes, include a minimal fixture and the source/time of the observation. Tests using fixtures do not confirm live TSE availability or election status.

For documentation-only work, inspect the entire diff and verify links and form structure. Record the actual checks and their limits; do not claim runtime validation from a documentation review. Existing project instructions and CI gates still apply.

Review the diff before publishing. Keep credentials and private data out of issues, logs and examples. Changes can be reverted with a follow-up PR; describe any operational rollback separately.
