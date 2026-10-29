---
id: 01a18784-7b5f-772c-ba2a-a2458a987438
title: "Build the reactive classes and motion: dromon/reactivity, dromon/reactivity/window and dromon/motion"
ord: 2
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
---
The runtime spec's entries `dromon/reactivity` (`SvelteMap`, `SvelteSet`, `SvelteDate`, `SvelteURL`, `SvelteURLSearchParams`, `MediaQuery`, `createSubscriber`), `dromon/reactivity/window` and `dromon/motion` (`Spring`, `Tween`, `prefersReducedMotion`), with their `svelte/*` counterparts in the adapter. They sit on the reactivity core's public sources and effects, in a module of their own. Done when their runtime-runes entries, the converted `svelte/units` entries for the reactivity classes and the `motion` suite pass on `targets/dromon`.