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

Svelte's tests under `src` and the signals suite drive internals, so their files are converted where every assertion has a public counterpart: the manifest's `conversions` names each converted file with its reason, and `copy.ts --check` holds it different from upstream and every other file equal. A converted file is a runes module — the internal effect, derived, proxy and snapshot functions replaced by `$effect.root`, `$effect.pre`, `$effect`, `$derived` and `$state` — so the suite strips its types with esbuild, compiles it with the target's `compileModule` into the run's work directory and imports the output, which the facade governs too. Before that it imports an empty component compiled in the reference configuration: compiled modules never import the async flag, components do, and without one the converted tests would run with async mode off. esbuild is loaded only for converted files, since it refuses to load under the jsdom environment motion runs in.

A copied file none of whose tests runs — all covered, its imports reaching upstream's internal sources — is never loaded; its manifest entries are registered skipped. The `units` suite holds many files, so each is a describe block and its entries are keyed `<file> > <describe path> > <title>`. A file that fails to compile or import registers its entries as failing with that error, so a target lacking one entry, such as `svelte/reactivity`, leaves the other files running.
