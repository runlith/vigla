---
id: 01a19e94-3fb8-7d5b-a72d-3163908a7579
title: Port upstream's compiler and SSR benchmarks into the benchmark runner
ord: 5
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e32-fb25-7109-9e5d-e26d8c51fa54",
    "status": "done"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fad9ca8ebb2
---
The compiler spec's performance criterion has no measurement: `benchmarks/` runs only the `reactivity` and `own` suites. Port upstream 5.57.3's `compiler` group (`parser_elements`, `parser_script_style`, `parser_typescript`) and its `ssr` wrapper benchmark over the public API, add a `compile` benchmark over the same inputs (upstream has none), and register both suites in the runner so one invocation measures Vigla and upstream alternately as the reactivity suite does. Prove each benchmark runs once on both targets; the parity medians are a separate heavy run.