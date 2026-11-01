---
id: 01a19454-63c8-70c2-96a1-509e5ed381c8
title: Resolve the 37 frozen Svelte defects and scheduler traps at the fork base
ord: 12
tags: ["task"]
fields:
  {
    "holder": "tagma:01a193e1-e009-75fe-ac94-1ff32a3298c8",
    "status": "done"
  }
edges:
  - kind: discovered-from
    to: 01a1863d-db39-787b-8f72-b03a2e546434
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fac9d5e3831
---
Reproduce the 37 originally selected Svelte reports and the named scheduler traps on Svelte 5.57.3 through public API; remove non-failing or external-contract cases with retained evidence, preserve fulfilled public differences, and fix remaining producers or route exact inputs to their owners.

Verification complete: 17 reports have fulfilled public proofs, nine were excluded on the measurements in [[2e546434]], and 11 remain routed. Blocks owns #17395, #16139, #17379, #16168, #10252, #6668, #4389, #15627 and the affected-engine checks for #6914/#4712. Kit owns #18993's original route shape, overlapping Kit #17383; its narrower Svelte hydration analogue passes. The two remaining DOM reproductions are committed unrecorded harness progress, with every input preserved. All nine named scheduler traps, five invariants and their control/extra variants pass in the focused 18-entry post-async check. The store producer and reviewed public proof deliveries are e5ca8856ad, 4b4034dba5 and 9fc15f670d; scheduler's four further fixes and samples are in 988eb01eb7/1268a180a0. Shared rows recorded before the changed delivery order remain the lead's to land.
