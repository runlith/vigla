---
id: 01a1d11c-eb74-78c8-9595-0cefc3d49be3
title: Blocks reach transitions only through the manager's lifecycle; geometry and leaving views load with the first transition or animation
ord: 3
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/transitions/manager.ts
  - kind: file
    ref: packages/vigla/src/runtime/transitions/directives.ts
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/outgoing.ts
    symbol: departures
---
Every branch and list block calls `pause`, `resume`, `prepare` and `building` whether or not the application uses a transition, so whatever `manager.ts` imports is in every client bundle. The manager therefore holds only the bookkeeping those calls need — the managers and movers registered per effect, the live count, the intro rules — and imports nothing from the measuring and animating files, nor the core's leaving views. `transition` and `animation` live in `directives.ts`, which compiled code imports only for a component that uses a directive; their first call installs the geometry operations (`sweep`, layout capture, placement restore) and the leaving-view entry points (`leaving`, `stayed`) through `equip`. Until one is installed no manager or mover exists, so `prepare` measures nothing and returns, and `pause` never reaches a leaving view. The core in turn reaches leaving views only through the `departures` hooks in `outgoing.ts`, which the first `leaving` call sets: writes remember old values and reads consult a leaving view only once one has existed. An import from the manager of anything that measures or animates, or a direct import of `leaving.ts` from the core's write and read paths, puts that code back into every application's bundle.