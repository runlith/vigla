---
id: 01a1875f-0a59-76ea-b325-87d951d05a40
title: A harness run reaches every runner with its selection through the scope file VIGLA_SCOPE names, and keeps its reports apart
ord: 3
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fab49056597
sources:
  - kind: file
    ref: harness/src/cli.ts
  - kind: file
    ref: harness/src/reports.ts
  - kind: file
    ref: harness/src/scope.ts
---
`cli.ts` turns its selectors — `<project>`, `<project>/<suite>`, `<project>/<suite>/<entry prefix>` — or, under `--passing`, the recorded entries they reach, into a scope file and names it in `VIGLA_SCOPE`. A prefix selects an entry equal to it or continuing with ` (`, ` > ` or `/`, so `each` never selects `each-keyed`, and a selector that selects nothing fails the run instead of passing empty.

The scope travels as a file named by the environment because the code ruling a test runs several processes below the CLI — vitest workers, the Kit runner, Playwright workers, the plugin's vitest — and the environment reaches all of them, while a passing set outgrows what one variable may hold. Each layer cuts what it can: the Svelte suites register no unselected entry, so it neither compiles nor counts; the Kit runner skips apps and unit specs with no selected entry, and when every selected entry names its variant, the package scripts and script steps none of them names; the plugin's config excludes spec files with no selected entry; the gates skip the remaining unselected tests; the judge counts only selected entries. Kit's adapter Playwright tests import `test` from Playwright directly and pass no gate, so selecting one of their entries runs every Playwright test of its app; their vitest steps are gated like the rest.

Concurrent runs must keep separate report directories: each part clears its output before writing, so using the shared `.results` parent would erase its peers' evidence. The CLI allocates a per-process directory and passes each part its own path through `VIGLA_RESULTS`; a directly launched part allocates a per-process directory too and leaves its reports there. The CLI removes its default output at the end, while `--results <dir>` keeps the reports and their `runs.json` indexes for `compare.ts`.
