---
id: 01a19d8b-e861-731a-ae1a-1ec7ca3679ec
title: Preserve var hoisting for rune declarations
ord: 24
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
Reproduce and fix the remaining var-declarations DOM and hydrate variants. Match JavaScript var reads before initialization through compiler declaration and read lowering, with the frozen fixture as the behavioral contract; do not hide missing compiler storage or initialization behind runtime guards. Preserve function-local scope and later reactive updates, prove bounded public controls and record the two exact original variants with source.