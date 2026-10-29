---
id: 01a185b6-09f2-796e-90b2-9fab49056597
title: "Compatibility harness: upstream tests as data, run by Dromon's runners and validated on upstream first"
ord: 2
tags: ["spec"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fa8019de65b
---
**Samples are data, runners are ours.** Upstream samples and Kit test apps are copied from `.external` at the fork base into the repository unchanged, except the conversions to runes the manifest records. Dromon's runners reproduce what upstream's runners assert — the variants `dom`, `hydrate`, `ssr` and `async-ssr`, the `mode` and `skip_*` fields, the HTML comparison — through public API only.

**No internal resets.** Upstream's runner clears scheduler, hydration and server-context state between samples through internals. Dromon's runtime instead holds no state of an unmounted tree once its flush settled, so its runners reset nothing; that is a runtime invariant ([[9d5e3831]]), never a test-only entry.

**Validated on upstream first.** Each runner first targets upstream — `svelte@5.57.3`, `@sveltejs/kit@3.1.0` and `@sveltejs/vite-plugin-svelte@7.3.1` installed under alias names as dev dependencies — with runes forced and async on. The samples upstream passes define the contract; a sample that fails on upstream gets its status from the manifest rules of the milestone spec. A runner change is valid only when upstream's result stays the same.

**The manifest refuses gaps.** The harness fails when an upstream test of an in-scope suite has no status, so nothing is dropped silently. A run prints counts per suite and status, on upstream and on Dromon.

**Acceptance.**
- Every upstream test of the in-scope suites has a status in the manifest.
- Every contract entry passes against upstream through Dromon's runners.
- One command runs the whole harness against either target and prints the counts.
