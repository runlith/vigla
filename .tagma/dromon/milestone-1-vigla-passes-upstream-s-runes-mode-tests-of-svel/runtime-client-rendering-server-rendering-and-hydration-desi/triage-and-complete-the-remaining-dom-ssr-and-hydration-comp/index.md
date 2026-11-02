---
id: 01a193f2-ff55-75b7-98e3-3cbacd2aed6d
title: Triage and complete the remaining DOM, SSR and hydration compatibility
ord: 4
tags: ["task"]
fields:
  {
    "holder": "tagma:01a184d8-1b37-7bfc-8899-05d6b3ce2282",
    "status": "in_work"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
---
Classify unrecorded runtime-runes, hydration and SSR variants by their producing layer, excluding the units already held by other agents. Implement the remaining DOM, server-rendering and hydration causes, route compiler, store and scheduler causes to their owners with exact evidence, and record each newly passing variant with its supporting change. The 472-variant remainder now has 340 scoped passes, all recorded, and 132 unfinished variants: runes 294/418, hydration 14/14, SSR 32/40, none unreported. These are latest-per-entry measurements, not one HEAD-wide run. The lead holds integration of the remaining Core async/fork/derived, compiler/SSR and frozen-transition work; their active owners retain the producer changes.