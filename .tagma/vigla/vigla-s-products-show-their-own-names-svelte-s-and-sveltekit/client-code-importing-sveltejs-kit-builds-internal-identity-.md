---
id: 01a1a71d-a548-7e7e-baad-08e7aa0c5436
title: "Client code importing `@sveltejs/kit` builds: `internal/identity` stops carrying the server-only `sequencer`"
ord: 7
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1a393-beda-739e-b23d-167133dc7a86",
    "status": "done"
  }
edges:
  - kind: implements
    to: 01a1a3ed-6688-7f72-8a35-40a5ff420c2e
---
The facade's root entry imports `outcomes` from `@vigla/kit/internal/identity`, which also re-exports `sequencer`; that drags `server/scope.ts` into every client graph, and its import of `carryAcrossAwait`, which only the core's server variant exports, fails the client build with `MISSING_EXPORT`. Recorded prerendering entries went red on it. `sequencer` moves to its own facade-only entry, `internal/sequence`.