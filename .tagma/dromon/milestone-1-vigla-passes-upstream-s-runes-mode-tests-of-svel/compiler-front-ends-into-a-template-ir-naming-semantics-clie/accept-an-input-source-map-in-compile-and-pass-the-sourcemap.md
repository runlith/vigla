---
id: 01a187b5-42f7-7bb6-a2cc-2cedd9d78ae9
title: Accept an input source map in `compile` and pass the sourcemaps suite
ord: 4
tags: ["task"]
fields:
  {
    "holder": "tagma:01a18754-3aa0-76c8-9776-449a21a808bb",
    "status": "in_work"
  }
edges:
  - kind: discovered-from
    to: 01a18752-ff03-7988-bdb3-d50f7b2f1bd2
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fad9ca8ebb2
---
`svelte/compiler`'s `compile` still refuses the `sourcemap` option (a preprocessor's map) as `unsupported`. The JS and CSS maps are not merged with it as upstream's `merge_with_preprocessor_map` does. svelte/sourcemaps fails 27 of 27 running entries on vigla, so the compiler spec's sourcemaps acceptance is unmet.