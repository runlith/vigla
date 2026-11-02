---
id: 01a19d0b-94e6-78a1-8744-37c1b06b2f90
title: Restore owner scope for async component continuations
ord: 10
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: discovered-from
    to: 01a193f2-ff55-75b7-98e3-3cbacd2aed6d
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
---
Complete dom/hydrate variants of async-derived-with-effect-and-boundary, async-effect-after-await and async-fork-discard-after-in-check. The fresh remainder reports effect_orphan when dom/context.pop invokes deferred effects with a null owner. Recheck after the service-owned-cell fix, trace compiler continuation and DOM/Core owner restoration through cancellation, and correct the first losing producer. Preserve legitimate orphan/disposed-owner diagnostics and general application-level owner primitives. Retain exact scoped proof and land all newly green ids with the supporting source.