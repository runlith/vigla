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
    to: 01a1a3c1-fa06-7690-8926-459c574270c3
sources:
  - kind: dir
    ref: harness
---
Vigla's compatibility harness runs copied upstream tests and its own regression samples through shared runners against an install tree, so the same samples judge upstream first and Vigla after. It owns the copied samples, the import rewrite map, the manifest giving each sample and variant a status, and the runners with their timing fakes and HTML comparison; what a target must reset between samples is that target's own hook.