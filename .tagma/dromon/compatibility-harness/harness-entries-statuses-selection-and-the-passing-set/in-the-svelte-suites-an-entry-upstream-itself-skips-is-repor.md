---
id: 01a19e9d-a45b-7f25-99b0-8a5eec6f403e
title: In the Svelte suites, an entry upstream itself skips is reported as skipped by upstream, outside the status counts and the passing set
ord: 4
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a18616-570f-7d0c-9712-d2bf5d8f8564
  - kind: relates
    to: 01a1875f-09cc-76a4-b488-9c16f5ffac8a
sources:
  - kind: symbol
    ref: harness/src/suites.ts
    symbol: upstreamSkip
  - kind: file
    ref: harness/src/samples.ts
  - kind: file
    ref: harness/src/runtime/suite.ts
  - kind: file
    ref: harness/src/units/vitest.ts
  - kind: file
    ref: harness/src/judge.ts
---
Upstream skips some of its own Svelte tests: `skip: true` in a sample's `_config.js`, a `skip_mode` naming a variant upstream still registers, `it.skip` or `test.skip` in a runner or unit-test file, a `.svelte` sample of `types`, which upstream's `tsc` check never reads. Such an entry is neither dropped nor a difference, since Vigla rejects nothing in it, yet it can never pass; counted under its `contract` or `converted` status it would leave the milestone's acceptance that every entry not dropped passes unmeetable. Registration therefore marks it skipped by upstream in the test's vitest metadata, which the JSON report carries; the judge counts it on a line of its own and fails a recorded line naming it, so it never joins the passing set.

The mark is taken at each run from upstream's test as the harness carries it — the copied config or unit file, or the ported runner test — and never from the manifest, so a release that un-skips the test turns it back into an ordinary entry of its status. Only an entry whose status runs is marked: a dropped entry upstream also skips stays in the dropped count. Where two upstream tests share one title and only one is skipped, the entry is judged by the one that ran and counted under its status. The mark is set by the Svelte suites' sample, unit-file and types runners only: Kit's and vite-plugin-svelte's tree suites read Playwright and vitest reports that carry none, so an upstream `test.skip` there, such as basics' cross-platform server tests, still counts as skipped under its status.
