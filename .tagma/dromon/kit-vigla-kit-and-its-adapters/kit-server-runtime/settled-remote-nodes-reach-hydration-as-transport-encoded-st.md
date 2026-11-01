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
---
The core's owner hydration store does not know an app's transport codecs. Kit registers serialized result or transformed-error nodes under the remote cache key and the browser decodes them with the same transport as fetched responses. Pending loading-state reads are not registered, so a page can finish SSR without waiting for work it never awaited; the optional hydrated read then fetches on the browser. Native form outputs use their action identity in the same channel.