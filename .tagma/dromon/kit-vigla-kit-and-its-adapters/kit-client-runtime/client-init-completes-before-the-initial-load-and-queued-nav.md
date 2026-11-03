---
id: 01a19403-abdf-7b9f-a957-763935bd12db
title: Client init completes before the initial load and queued navigation
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/client/client.ts
  - kind: file
    ref: packages/kit/src/client/fetch.ts
---
The tab owner exists before `hooks.client.init` so its context reaches the initial universal loads and mounted tree. Router interception starts before `init`, but navigations wait for the initial view to settle and automatic link preloads wait for `init`; otherwise an onMount click can escape as a document navigation or a preload can run rerouting against uninitialized state. Explicit route-module preloads remain available during `init`. Awaiting a queued `goto` inside `init` would deadlock the startup it depends on and is unsupported. The HTML boot data is a thunk evaluated under that owner after `init`, so transport decoders can create application state before universal loads run. If history has changed the rendered request path or dynamic SSR query before client start, the client mounts the current route without replaying that document's fetches; fragments are not sent to the server and prerendered documents accept arbitrary queries. Otherwise the initial fetch cache consumes the server's serialized responses instead of issuing them twice. A replay's remaining TTL is admitted as a duration, not an absolute value on the navigation clock; using the latter makes cache hits depend on how long code imports took before hydration.