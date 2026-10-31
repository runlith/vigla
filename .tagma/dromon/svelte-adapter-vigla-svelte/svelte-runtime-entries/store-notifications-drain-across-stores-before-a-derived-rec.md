---
id: 01a193f4-e0f0-74ec-b508-63b586989a01
title: Store notifications drain across stores before a derived recomputes
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/svelte/src/entries/store.ts
  - kind: file
    ref: packages/svelte/src/entries/store-client.ts
  - kind: file
    ref: packages/svelte/src/entries/store-server.ts
---
A writable invalidates its subscribers before their queued notifications drain, and nested writes append to the same queue. A derived waits until every invalidated input has delivered its value, preventing mixed values through diamonds and shared ancestors. Subscription startup publishes its final synchronous value only once, while the last unsubscribe stops the producer immediately. Client state interop uses the core's owner lifetimes and tracked subscriber primitive; server interop reads snapshots without starting reactive effects.