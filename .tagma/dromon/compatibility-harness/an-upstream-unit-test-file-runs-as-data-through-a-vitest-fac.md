---
id: 01a1863c-2a1d-7b49-8910-3da64ae5fc67
title: An upstream unit-test file runs as data through a vitest facade that rules each test from the manifest
ord: 9
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a18616-570f-7d0c-9712-d2bf5d8f8564
sources:
  - kind: dir
    ref: harness/src/units
---
A suite that upstream writes as one test file (`motion/test.ts`, `css-parse.test.ts`) has no samples to iterate: the file itself is the data, copied with the rewrite map and imported by the harness. Its `vitest` import resolves, for files under that suite's samples only, to a facade re-exporting vitest whose `describe` and `it` look each test up in the manifest by its describe path and title and register it, or register it skipped when its status does not run. That keeps the copied file equal to upstream's while dropped tests — `spring` and `tweened`, imports Dromon rejects — stay out of the run and in the count. The file still names `spring` and `tweened` in its static import; a target without them loads it only because the target's package is inlined into Vite's transform, and Vite's module runner checks named imports against a module's exports only for externalized modules. Externalizing the target would turn the missing names into a load error that takes the retained `Tween` tests down with the dropped ones.

The facade captures the describe path when `describe` is called, not when its body runs: vitest collects nested describe bodies after the outer body has returned, so a path kept only on a stack would be empty for nested tests. A final `manifest` test fails on manifest entries no test registered, which a static check cannot see.
