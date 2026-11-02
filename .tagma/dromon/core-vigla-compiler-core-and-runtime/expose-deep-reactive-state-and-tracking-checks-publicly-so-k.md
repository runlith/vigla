---
id: 01a19e51-58b6-77b2-a1b3-745c5461ba0b
title: Expose deep reactive state and tracking checks publicly, so Kit uses no core internal
ord: 19
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e32-fa75-7284-935b-cb2fd711b818",
    "status": "in_work"
  }
edges:
  - kind: implements
    to: 01a19de0-59b2-7950-bf1d-a0b137f29ce1
---
Spec [[37f29ce1]] requires that no binding imports `vigla/internal/*`. Kit's client remote functions still do: `packages/kit/src/client/remote/form.ts` takes `proxy` and `cache.ts` takes `tracking` from `vigla/internal/client`. A library outside the compiler needs both — deep reactive state and knowing whether a reaction is reading — so each becomes a public core primitive with a clean name, on client and server entries, and Kit moves onto them.