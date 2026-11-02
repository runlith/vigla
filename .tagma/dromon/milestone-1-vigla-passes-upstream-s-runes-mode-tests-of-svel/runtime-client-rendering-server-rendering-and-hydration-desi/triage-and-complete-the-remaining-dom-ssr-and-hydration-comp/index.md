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
Classify unrecorded runtime-runes, hydration and SSR variants by their producing layer, excluding the units already held by other agents. Implement the remaining DOM, server-rendering and hydration causes, route compiler, store and scheduler causes to their owners with exact evidence, and record each newly passing variant with its supporting change. The refreshed 472-variant remainder has 438 measured passes and 34 unfinished variants: runes 384/418, hydration 14/14, SSR 40/40, none unreported. All 438 measured passes are recorded: server fallback rows in 03f8d519874, eight async rows in 8de4a3109d after their source-path eligibility audit, empty-class cases in fe10c84ce7, implicit children protection in 2b38381462, six async owner-restoration cases in 71c205ea48, twelve DEV ownership cases in e382078282, three SVG namespace DOM cases in d6e9c8826c, two var-hoisting cases in e5c4a2fe22, twenty async/fork output cases in a7d4368c91, and four DEV proxy diagnostic cases in 1eedb0a5cf. These are latest-per-entry measurements, not one HEAD-wide run. The lead holds integration of the remaining Core async/fork/derived, compiler/SSR and frozen-transition work; their active owners retain the producer changes.