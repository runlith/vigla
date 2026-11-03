---
id: 01a18616-570f-7d0c-9712-d2bf5d8f8564
title: The manifest gives each sample one status, overridable per variant, and only contract and converted entries run, beside project own's differences on Vigla
ord: 1
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
sources:
  - kind: file
    ref: harness/src/copy.ts
  - kind: file
    ref: harness/src/manifest.ts
---
An entry is `suite/sample/variant`; `suite/sample` for a compiler-side suite and for `types`, whose samples have no variants; `suite/test` for a test an upstream runner file declares beside its samples, named in the suite's `tests` in `suites.ts` so the copy check accepts it; or `suite/test` for a suite that is an upstream unit-test file (`motion`, `css-parse`, `signals`), whose test is its describe path and title joined by ` > `, prefixed by the file for `units`, which holds many ([[4ae5fc67]]); the manifest stores a status per sample with optional per-variant overrides, so a sample's entries are the variants the runner derives from its `_config.js` in the reference configuration, each resolving to exactly one status. A tree suite of Kit or vite-plugin-svelte keys an entry `<project>/<file> > <describe path> > <title>`, or `<file> > …` for unit specs, with the run mode as the variant, and its manifest's `conversions` gives each changed file a reason. Every status but contract carries a reason. Dropped, difference and covered entries are registered as skipped tests so the report counts them, except a `difference` of project `own` on a target other than upstream, which runs ([[59dee6f0]]); a sample without a status, or a manifest sample without a copy, fails the suite.

`copy.ts --check` keeps the data honest: a sample marked contract must equal upstream's with the rewrite map applied, and one marked converted must differ from it. Upstream's copy in `.external` is the only source, so the check runs where that clone exists.