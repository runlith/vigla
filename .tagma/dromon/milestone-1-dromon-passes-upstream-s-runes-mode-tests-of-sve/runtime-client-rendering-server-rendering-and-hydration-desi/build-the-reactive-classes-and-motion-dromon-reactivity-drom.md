---
id: 01a18784-7b5f-772c-ba2a-a2458a987438
title: "Build the reactive classes and motion: dromon/reactivity, dromon/reactivity/window and dromon/motion"
ord: 2
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
The runtime spec's entries `dromon/reactivity` (`ReactiveMap`, `ReactiveSet`, `ReactiveDate`, `ReactiveURL`, `ReactiveURLSearchParams`, `MediaQuery`, `createSubscriber`), `dromon/reactivity/window` and `dromon/motion` (`Spring`, `Tween`, `prefersReducedMotion`), with their `svelte/*` counterparts in the adapter re-exporting them under upstream's names (`SvelteMap` and the rest). They sit on the reactivity core's public sources and effects, in a module of their own. Done when their runtime-runes entries, the converted `svelte/units` entries for the reactivity classes and the `motion` suite pass on `targets/dromon`.