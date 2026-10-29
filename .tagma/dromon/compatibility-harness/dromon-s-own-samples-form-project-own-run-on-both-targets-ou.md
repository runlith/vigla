---
id: 01a1868a-e2e4-7d6e-a8fa-25e459dee6f0
title: Dromon's own samples form project `own`, run on both targets outside the upstream equality
ord: 14
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fab49056597
sources:
  - kind: dir
    ref: harness/samples/own
  - kind: file
    ref: harness/src/compare.ts
  - kind: file
    ref: harness/src/suites.ts
---
Samples Dromon writes itself — the scheduler traps, invariant tests, the end-to-end sample of the core's first code — live in project `own` (`harness/samples/own/<suite>`, `harness/manifest/own/<suite>.json`) and run through the same runners on both targets, so each is checked on upstream before Dromon's run counts. Such a suite declares no upstream file: `compare.ts` leaves it out of the equality with upstream's own runner, which has no such samples, and `copy.ts` has no upstream source for its project. Its manifest gives each sample a status like any other, so the runner's rule that every sample has one still holds. A sample that reproduces an upstream defect Dromon fixes is red on upstream by design and is Dromon's test of the fix, so in this project alone a `difference` runs on every target but upstream, where it stays skipped; its reason carries the upstream run.
