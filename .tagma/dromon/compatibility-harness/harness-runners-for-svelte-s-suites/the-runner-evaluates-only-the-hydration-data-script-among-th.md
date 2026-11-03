---
id: 01a18616-321a-7d0e-9a02-dfbffdf66f8b
title: The runner evaluates only the hydration-data script among the head scripts server rendering emits
ord: 8
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fab49056597
sources:
  - kind: symbol
    ref: harness/src/runtime/run.ts
    symbol: runHeadScripts
---
Head HTML inserted through `innerHTML` never executes, so before hydrating the runner evaluates the script a browser would have run for `hydratable` data, found by its `window.__svelte ??= {}` text as upstream's runner finds it. Evaluating every inline head script would also run the dev-mode `<script>console.error(...)</script>` tags of `node_invalid_placement_ssr`, doubling the errors `invalid-html-ssr` samples count. The marker is upstream's script text: a target emitting another hydration-data script needs this predicate to follow it.