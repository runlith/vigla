---
id: 01a187bd-e58e-7882-9c64-fae418924327
title: Give targets/vigla its vite-plugin and Kit parts, upstream's plugin and Kit standing in until Vigla's exist
ord: 8
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fab49056597
  - kind: relates
    to: 01a187bd-e581-7ebe-85bb-fecb6aa3c486
---
`targets/vigla` runs only the Svelte suites. Add its `vite-plugin` and `kit` parts as `targets/upstream` has them, with `svelte` resolving to `@vigla/svelte`. Until `@vigla/vite-plugin` and `@vigla/kit` exist, upstream's vite-plugin-svelte 7.3.1 and Kit 3.1.0 stand in, so real Vite and Kit apps exercise Vigla's compiler and runtime now; each part switches to Vigla's package in the change that makes that package installable, and the passing set judges the switch.