---
id: 01a1a453-d4cf-7350-bca2-6e533a5a7984
title: Scroll and registered snapshots persist as upstream's session-storage records, named by the identity
ord: 20
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a1a410-e35e-7113-83cf-8d5db13f8be3
sources:
  - kind: file
    ref: packages/kit/src/client/restore.ts
---
`<name>:history-info` holds each history entry's scroll position and `<name>:navigation-snapshot` the snapshots registered through `snapshot(...)` per history entry. Upstream's third record, `<name>:snapshot`, holds the page components' `snapshot` exports per navigation, so shallow entries of one page share its component snapshot but keep their own registered ones; Kit does not write it, and the facade's restorer ([[5db5fd3b]]) keeps it. These are upstream's records in its keys and shapes, so a tab whose state SvelteKit persisted restores when Kit replaces it under the facade's identity. The records are per origin, not per app path: two apps on one origin under the same identity share them, as upstream's do.