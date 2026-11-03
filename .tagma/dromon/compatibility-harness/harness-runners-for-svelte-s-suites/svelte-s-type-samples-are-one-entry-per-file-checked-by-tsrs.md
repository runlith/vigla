---
id: 01a1a134-ba12-7028-9dc3-fd8c77a34629
title: Svelte's type samples are one entry per file, checked by tsrs in one program against the target's published declarations
ord: 9
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
  - kind: relates
    to: 01a186ae-4062-7026-8b94-fdeb26c2ff0e
sources:
  - kind: file
    ref: harness/src/types/suite.ts
  - kind: file
    ref: harness/src/types/reference.ts
  - kind: file
    ref: harness/src/checker.ts
---
Upstream checks `tests/types` with `tsc` in that directory, its `paths` mapping `svelte` to the sources; there is no vitest runner to port. The harness copies the samples, writes a tsconfig with upstream's compiler options minus the source `paths`, lists the target's published `types/index.d.ts` by real path as Kit's types suite does, and runs tsrs once over every selected running `.ts` sample; each sample is one entry, keyed by its file name, that passes when no diagnostic lands in it. A diagnostic outside the checked samples — in the declarations, or with no location — fails every entry, since the samples were then checked against a broken program.

Upstream's `tsc` reads only `.ts` files, so `bindings.svelte` is never checked by upstream and is reported as skipped by upstream. Checking it needs svelte2tsx with svelte-check's shims and `svelte-html.d.ts`, which is svelte-check's own pipeline, not a runner to reproduce; svelte-check over the aliased install is what proves it.

The reference is upstream's `tsc` run in the same copy the vitest reference uses: `harness/src/types/reference.ts` adds its verdict per file to that run's JSON report as a module named after `tests/types`, so one `compare.ts` call covers it with the other suites.