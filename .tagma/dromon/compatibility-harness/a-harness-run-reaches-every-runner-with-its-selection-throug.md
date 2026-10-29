---
id: 01a1875f-0a59-76ea-b325-87d951d05a40
title: A harness run reaches every runner with its selection through the scope file DROMON_SCOPE names, and keeps its reports apart
ord: 18
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fab49056597
sources:
  - kind: file
    ref: harness/src/scope.ts
  - kind: file
    ref: harness/src/cli.ts
---
`cli.ts` turns its selectors — `<project>`, `<project>/<suite>`, `<project>/<suite>/<entry prefix>` — or, under `--passing`, the recorded entries they reach, into a scope file and names it in `DROMON_SCOPE`. A prefix selects an entry equal to it or continuing with ` (`, ` > ` or `/`, so `each` never selects `each-keyed`, and a selector that selects nothing fails the run instead of passing empty.

The scope travels as a file named by the environment because the code ruling a test runs several processes below the CLI — vitest workers, the Kit runner, Playwright workers, the plugin's vitest — and the environment reaches all of them, while a passing set outgrows what one variable may hold. Each layer cuts what it can: the Svelte suites register no unselected entry, so it neither compiles nor counts; the Kit runner skips apps and unit specs with no selected entry and the plugin's config excludes such spec files; the gates skip the remaining unselected tests; the judge counts only selected entries. Kit's adapter tests import `test` from Playwright directly and pass no gate, so selecting one of their entries runs its whole app.

Every run writes its reports to a directory of its own, `.results/run-<pid>` under the target, and removes it at the end, because several sessions run the harness against one target at once. `--results <dir>` keeps them: `svelte.json` and one directory per tree part, each with `runs.json` indexing its reports, the inputs `compare.ts` takes.
