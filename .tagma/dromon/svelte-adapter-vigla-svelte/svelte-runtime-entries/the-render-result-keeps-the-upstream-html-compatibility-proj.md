---
id: 01a19c30-5dea-7dbe-aea5-088fd45e165d
title: The render result keeps the upstream HTML compatibility projection in the adapter
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/svelte/src/entries/server.ts
---
The synchronous result's `html` getter exposes the same body for callers such as nested server renders. An awaited result rejects that deprecated getter with `html_deprecated`, while preserving `head`, `body` and script hashes. This projection belongs to the adapter so the general Core result carries only its own output contract.