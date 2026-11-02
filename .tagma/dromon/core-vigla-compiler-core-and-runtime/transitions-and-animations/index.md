---
id: 01a187ee-bdbe-7def-8088-abb9f99c705e
title: Transitions and animations
ord: 14
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "manager.ts"
      },
      {
        "at": "easing.ts"
      },
      {
        "at": "presets.ts"
      },
      {
        "at": "flip.ts"
      },
      {
        "at": "animate.ts"
      }
    ],
    "id": "transitions",
    "kind": "product",
    "order": [
      [
        "easing.ts",
        "placement.ts"
      ],
      [
        "animate.ts"
      ],
      [
        "layout.ts"
      ],
      [
        "manager.ts",
        "presets.ts",
        "flip.ts"
      ]
    ]
  }
edges:
  - kind: imports
    to: 01a18680-7db9-7c10-b0ec-c0d1e0e72677
  - kind: imports
    to: 01a18680-7dbf-7586-9429-a423940f08ed
  - kind: imports
    to: 01a18792-64a4-7342-8c33-c00c6ca88dc0
sources:
  - kind: dir
    ref: packages/vigla/src/runtime/transitions
---
Element transitions and keyed-row animations: the managers a `transition:`, `in:`, `out:` or `animate:` directive attaches to the effect rendering its element, the intro and outro rules a block's branches follow when they enter, leave and come back, the keyframe animator driving them on Web Animations and animation frames, and the presets and easings an application imports from `vigla/transition`, `vigla/animate` and `vigla/easing`. It builds on the reactivity core's effects and tasks alone; the blocks decide when a branch leaves or returns and ask it to play.