---
id: 01a19426-a82d-7513-afba-0b224ebef77f
title: Prove application primitives against Layer's public hooks and lifetime traps
ord: 5
tags: ["task"]
fields:
  {
    "holder": "tagma:01a193e1-e009-75fe-ac94-1ff32a3298c8",
    "status": "in_work"
  }
edges:
  - kind: implements
    to: 01a18776-8e37-7bdc-93a5-7dae8191e72f
---
Read Layer's WorldHooks and Svelte-binding traps without importing Layer into Vigla. Verify or complete the own samples covering public hook implementations, detached service lifetimes and settled async work, session handoff, deferred trees, seat release, and owner context after await; record each compatibility sample's upstream 5.57.3 result and close the application-primitives spec when its acceptance holds.