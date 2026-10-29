---
id: 01a18792-64a4-7342-8c33-c00c6ca88dc0
title: Reactive classes and motion
ord: 13
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "date.ts",
        "for": [
          "33d45c4b"
        ]
      },
      {
        "at": "map.ts",
        "for": [
          "33d45c4b"
        ]
      },
      {
        "at": "media.ts",
        "for": [
          "33d45c4b"
        ]
      },
      {
        "at": "motion.ts",
        "for": [
          "33d45c4b"
        ]
      },
      {
        "at": "search.ts",
        "for": [
          "33d45c4b"
        ]
      },
      {
        "at": "server.ts",
        "for": [
          "33d45c4b"
        ]
      },
      {
        "at": "set.ts",
        "for": [
          "33d45c4b"
        ]
      },
      {
        "at": "spring.ts",
        "for": [
          "33d45c4b"
        ]
      },
      {
        "at": "subscriber.ts",
        "for": [
          "33d45c4b"
        ]
      },
      {
        "at": "tween.ts",
        "for": [
          "33d45c4b"
        ]
      },
      {
        "at": "url.ts",
        "for": [
          "33d45c4b"
        ]
      },
      {
        "at": "window.ts",
        "for": [
          "33d45c4b"
        ]
      },
      {
        "at": "window-server.ts",
        "for": [
          "33d45c4b"
        ]
      }
    ],
    "id": "classes",
    "kind": "product",
    "order": [
      [
        "local.ts",
        "frames.ts",
        "window-server.ts"
      ],
      [
        "subscriber.ts",
        "date.ts",
        "spring.ts",
        "tween.ts"
      ],
      [
        "map.ts",
        "set.ts",
        "search.ts",
        "media.ts",
        "window.ts",
        "server.ts"
      ],
      [
        "url.ts",
        "motion.ts"
      ]
    ]
  }
edges:
  - kind: imports
    to: 01a18680-7dbf-7586-9429-a423940f08ed
sources:
  - kind: dir
    ref: packages/vigla/src/runtime/classes
---
The reactive built-ins and animated values an application imports from `vigla/reactivity`, `vigla/reactivity/window` and `vigla/motion`: `ReactiveMap`, `ReactiveSet`, `ReactiveDate`, `ReactiveURL` and `ReactiveURLSearchParams`, whose reads track per key or per field; `MediaQuery` and the window readings, built on `createSubscriber`, which ties an external event source's subscription to the effects reading it; and `Spring` and `Tween`, which step a value on animation frames. It builds only on the reactivity core's public sources, deriveds and effects and works under any owner, never only inside components; on the server the collections are the plain built-ins and no subscription starts.