---
id: 01a19e67-05c0-7a6c-868c-df8ffe9e3bcf
title: Give owner context and lifecycle one home and break the reactivity import cycle
ord: 23
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e8e-1ebc-75c8-bf20-40d6cc82a51d",
    "status": "in_work"
  }
edges:
  - kind: implements
    to: 01a19de0-59b2-7950-bf1d-a0b137f29ce1
  - kind: waits-on
    to: 01a19e65-500e-7822-bece-d795b5ca984d
  - kind: waits-on
    to: 01a19e65-500e-7822-bece-d796410d878d
---
From the core architecture review (O4): owner-level context and lifecycle are implemented twice, in `runtime/dom/context.ts` and `runtime/server/context.ts`, while the reactivity module carries only part of it; and 19 of the 23 reactivity files form one import cycle, DEV tracing included. Move owner context and `onDispose` into the owners module with a hook the DOM and server component layers plug into, and give the reactivity card floors so imports run one way. Starts after the owner-lifetime and server-isolation tasks land, since both rewrite these files.