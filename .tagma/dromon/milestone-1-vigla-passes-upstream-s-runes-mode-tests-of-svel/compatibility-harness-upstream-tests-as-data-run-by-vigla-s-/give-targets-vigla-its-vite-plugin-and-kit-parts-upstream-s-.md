---
id: 01a187bd-e58e-7882-9c64-fae418924327
title: Give targets/vigla its vite-plugin and Kit parts, upstream's plugin and Kit standing in until Vigla's exist
ord: 8
tags: ["task"]
fields:
  {
    "holder": "tagma:01a18754-3a7f-7a8c-b16f-398394e4ee29",
    "status": "done"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fab49056597
  - kind: relates
    to: 01a187bd-e581-7ebe-85bb-fecb6aa3c486
---
Add the `vite-plugin` and `kit` parts to `targets/vigla`, with `svelte` resolving to `@vigla/svelte`. Both parts now install the available `@vigla/vite-plugin` under its upstream name; Kit remains upstream 3.1.0 until `@vigla/kit` exists. The commit records 10 plugin units, re-proved on the new plugin by the front-end worker, and 47 Kit units plus 7 type entries checked against the retained reports. The original plugin e2e baseline was 9 serve and 35 build entries; its passing file and revalidation after the switch are handed to the front-end worker, outside this commit. Kit apps, adapters, prerendering and build-errors remain unmeasured on Vigla. Compiler-hook smoke checks passed on both targets and the harness typecheck passed; full upstream equality and heavy suites were not rerun.