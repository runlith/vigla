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
The tab owner exists before `hooks.client.init` so its context reaches the initial universal loads and mounted tree. Route modules can preload during `init`, while `goto` queues until the initial navigation has settled; awaiting that queued `goto` inside `init` would deadlock the startup it depends on and is unsupported. The HTML boot data is a thunk evaluated under that owner after `init`, so transport decoders can create application state before universal loads run. The initial fetch cache consumes the server's serialized responses instead of issuing them twice. A replay's remaining TTL is admitted as a duration, not an absolute value on the navigation clock; using the latter makes cache hits depend on how long code imports took before hydration.