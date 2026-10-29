---
id: 01a185f3-77d2-77bc-849e-166adfbddb8b
title: Bootstrap the workspace and pass runtime-runes through Dromon's runners on targets/upstream
ord: 1
tags: ["task"]
fields:
  {
    "status": "open"
  }
---
The harness's first slice, before any Dromon code: the Bun workspace with tsrs typecheck and vitest; `targets/upstream` with `svelte` 5.57.3; a target-agnostic runner for the runtime-runes suite — variants `dom`, `hydrate`, `ssr` and `async-ssr`, internals replaced and the upstream target's fresh-state hook as [[49056597]] states — over samples copied from `.external/svelte` with the import rewrite map; manifest entries for runtime-runes. Done when, on `targets/upstream`, the runner passes exactly the runtime-runes contract entries upstream's own runner passes with runes and async on, and no runner imports under `svelte/internal`.