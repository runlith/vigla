---
id: 01a1941d-6c20-727f-a11f-bc3cf4f147c2
title: Boot readiness installs the chunk channel without waiting for the initial load
ord: 3
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/client/payload.ts
  - kind: file
    ref: packages/kit/src/client/chunks.ts
  - kind: file
    ref: packages/kit/src/client/client.ts
---
An initial universal load can await a streamed server value, so making chunk delivery wait for the completed startup would deadlock it. Payload initialization installs the global's deferral channel before importing the app; chunk thunks arriving early stay undecoded until the tab owner has completed its init hook. Transport decoders then run under that owner, including when a value arrives after initial hydration.