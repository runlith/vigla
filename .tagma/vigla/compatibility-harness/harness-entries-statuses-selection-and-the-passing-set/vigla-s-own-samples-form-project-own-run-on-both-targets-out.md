---
id: 01a1868a-e2e4-7d6e-a8fa-25e459dee6f0
title: Vigla's own samples form project `own`, run on both targets outside the upstream equality
ord: 5
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fab49056597
sources:
  - kind: dir
    ref: harness/samples/own
  - kind: dir
    ref: harness/src/units
  - kind: file
    ref: harness/src/compare.ts
  - kind: file
    ref: harness/src/judge.ts
  - kind: file
    ref: harness/src/kit/gate.ts
  - kind: file
    ref: harness/src/suites.ts
  - kind: symbol
    ref: harness/src/trees.ts
    symbol: Tree
---
Samples Vigla writes itself — the scheduler traps, invariant tests, the end-to-end sample of the core's first code — live in project `own` (`harness/samples/own/<suite>`, each sample carrying its own ruling file, [[5d8f8564]]) and run through the same runners on both targets, so each is checked on upstream before Vigla's run counts. Own samples declare no upstream source: `compare.ts` leaves their suites and trees out of the equality with upstream's own runner, which has no such samples, and `copy.ts` refuses them. Sample-project identity does not choose the runner: `own/kit` uses the existing Kit app runner, installed target packages and public manifest gate while keeping its selection, reports and passing entries under `own`. Kit's reference runner discovers only the copied Kit units. Each sample's ruling gives it a status like any other, so the runner's rule that every sample has one still holds. A sample that reproduces an upstream defect Vigla fixes is red on upstream by design and is Vigla's test of the fix, so in this project alone a `difference` runs on every target but upstream, where it stays skipped; its reason carries the upstream run. `cli.ts targets/upstream --differences` re-proves that red half: `VIGLA_DIFFERENCES=1` reaches every runner, own differences run on upstream, and the judge lists each as red (the expected proof, with its failure message) or fails the run for one that passes or does not run. A red there proves only that the test fails on upstream; whether it fails on the asserted defect rather than a load error is read from the message.
