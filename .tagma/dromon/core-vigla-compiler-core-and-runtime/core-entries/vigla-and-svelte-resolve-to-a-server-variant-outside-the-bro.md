---
id: 01a18775-9064-7b43-9265-816d448b42ec
title: "`vigla` and `svelte` resolve to a server variant outside the `browser` condition"
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/entries/index-server.ts
  - kind: file
    ref: packages/vigla/package.json
  - kind: file
    ref: packages/svelte/package.json
---
Server code imports the same `svelte`/`vigla` names as client code — compiled server components and the libraries they call `onMount`, `getContext` or `flushSync` from — and must get server behaviour: `onMount` and `flushSync` do nothing, contexts live in the render, `mount`/`hydrate`/`unmount`/`fork` throw `lifecycle_function_unavailable`. So `.` maps `browser` to the client entry and `worker`/`default` to `index-server`, as upstream's `svelte` does. The adapter cannot re-export the conditional `vigla` from its own conditional files — the condition set applying to the adapter's import of `vigla` is not the one its own importer was resolved under — so the core also publishes both variants unconditionally as `vigla/internal/index-client` and `vigla/internal/index-server`, and each adapter file re-exports one. `vigla/reactivity`, `vigla/reactivity/window` and `vigla/motion` split the same way, published as `vigla/internal/{reactivity,window,motion}-{client,server}`: on the server the collections are the plain built-ins, `MediaQuery` holds its fallback, `createSubscriber` returns a no-op and the window readings are `undefined`, as upstream's server entries have them.