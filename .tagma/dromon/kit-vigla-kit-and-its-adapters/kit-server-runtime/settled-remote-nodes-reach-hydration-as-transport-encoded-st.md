---
id: 01a1946d-d12b-75fc-9a2f-9f5a9bfbe42a
title: Settled remote nodes reach hydration as transport-encoded strings
ord: 9
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/server/remote/resource.ts
  - kind: file
    ref: packages/kit/src/server/remote/form.ts
  - kind: file
    ref: packages/kit/src/client/remote/cache.ts
---
The core's owner hydration store does not know an app's transport codecs. Kit collects settled result or transformed-error nodes per request and publishes their final transport-encoded strings in `beforeSnapshot`; the browser decodes them with the same transport as fetched responses. Deferred publication lets a later set, refresh or form field preset supersede an earlier value without changing an immutable core snapshot. An explicit set of an exported query is a hydration seed even inside another query, because the browser may first read that child after rendering. Pending loading-state reads stay absent, so the optional hydrated read fetches on the browser. Native form outputs use their action identity and a synchronous encoded string, letting the first field read restore server input.