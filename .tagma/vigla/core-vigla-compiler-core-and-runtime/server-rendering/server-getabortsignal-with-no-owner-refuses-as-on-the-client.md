---
id: 01a1b950-03d1-7e36-8251-44993b6cd216
title: Server `getAbortSignal()` with no owner refuses, as on the client; `svelte`'s server entry keeps upstream's answer
ord: 11
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: relates
    to: 01a1877e-fd98-7ad3-8502-952177d1c74f
---
The core's server `getAbortSignal()` with no owner returns a fresh signal that never aborts (`runtime/server/context.ts`), while the client refuses with `get_abort_signal_outside_reaction`. A signal that never fires is the same silent answer a context read with no owner used to give ([[77d1c74f]]). Upstream's server returns that never-aborting signal outside a render, so `svelte`'s server entry keeps it as its projection, and the core refuses.

Acceptance: the core's server variant refuses with no owner, `svelte`'s server entry answers as upstream's does, and the upstream samples calling `getAbortSignal` stay green.
