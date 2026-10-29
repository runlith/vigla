---
id: 01a18616-570f-7d0c-9712-d2bf5d8f8564
title: The manifest gives each sample one status, overridable per variant, and only contract and converted entries run
ord: 5
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
sources:
  - kind: file
    ref: harness/src/manifest.ts
  - kind: file
    ref: harness/src/copy.ts
---
An entry is `suite/sample/variant`, or `suite/test` for a suite that is an upstream unit-test file (`motion`), whose test is its describe path and title joined by ` > `; the manifest stores a status per sample with optional per-variant overrides, so a sample's entries are the variants the runner derives from its `_config.js` in the reference configuration, each resolving to exactly one status. Every status but contract carries a reason. Dropped, difference and covered entries are registered as skipped tests so the report counts them; a sample without a status, or a manifest sample without a copy, fails the suite.

`copy.ts --check` keeps the data honest: a sample marked contract must equal upstream's with the rewrite map applied, and one marked converted must differ from it. Upstream's copy in `.external` is the only source, so the check runs where that clone exists.