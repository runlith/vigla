---
id: 01a19411-bbb6-72b6-a781-69bdbda908b0
title: Hydratable data is snapshotted per render before promises finish
ord: 3
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/server/hydration.ts
  - kind: symbol
    ref: packages/vigla/src/runtime/server/context.ts
    symbol: capture
  - kind: symbol
    ref: packages/vigla/src/runtime/server/render.ts
    symbol: render
---
A key keeps its first value and its initial serialized graph, so a later mutation cannot silently change the snapshot or hide a DEV clobbering error. Promise slots resolve separately and expand through a resolver name absent from devalue's generated scopes; their markers contain an unescaped `<`, which ordinary serialized data cannot contain. The emitted script uses the caller's format, and a CSP hash covers its exact body bytes rather than the surrounding tag.