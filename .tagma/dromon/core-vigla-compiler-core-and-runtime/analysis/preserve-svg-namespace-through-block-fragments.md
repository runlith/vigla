---
id: 01a19d84-b1c0-7aad-b915-9f5413c6559e
title: Preserve SVG namespace through block fragments
ord: 5
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: discovered-from
    to: 01a193f2-ff55-75b7-98e3-3cbacd2aed6d
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fad9ca8ebb2
---
Reproduce and fix the three remaining DOM variants svg-namespace-if-block-2, svg-namespace-if-block-3 and svg-namespace-infer-a-tag. Trace the first incorrect namespace through analysis, client output and fragment creation; change its producer rather than adding a runtime repair. Preserve HTML and foreignObject boundaries, run bounded public controls, and land the three manually recorded passing ids with their supporting source. Earlier remainder measurements are routing evidence, not current-tree proof.