---
id: 01a18612-2431-7b09-97cb-71fe6fa5bba6
title: Compatibility harness
ord: 13
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "src/vitest.ts",
        "for": [
          "e3f1d060"
        ]
      },
      {
        "at": "src/target.ts",
        "for": [
          "e3f1d060"
        ]
      },
      {
        "at": "src/clock.ts",
        "for": [
          "e3f1d060"
        ]
      },
      {
        "at": "src/vite-plugin/config.ts",
        "for": [
          "e3f1d060"
        ]
      }
    ],
    "id": "harness",
    "kind": "substrate"
  }
edges:
  - kind: imports-tests
    to: 01a187ca-e656-7569-8564-ac0fabdaf506
sources:
  - kind: dir
    ref: harness
---
Vigla's compatibility harness runs upstream's test samples, copied in as data, through runners of its own against an install tree, so the same samples judge upstream Svelte first and Vigla after. It owns the copied samples, the import rewrite map, the manifest giving each sample and variant a status, and the runners with their timing fakes and HTML comparison; what a target must reset between samples is that target's own hook.