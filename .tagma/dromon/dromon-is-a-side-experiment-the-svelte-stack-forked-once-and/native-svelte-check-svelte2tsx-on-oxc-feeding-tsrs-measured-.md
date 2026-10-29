---
id: 01a1852f-ba89-7089-9ac3-30ee776060b7
title: "Native svelte-check: svelte2tsx on oxc feeding tsrs, measured against svelte-check on tsgo"
ord: 7
tags: ["idea"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: relates
    to: 01a1852f-ba89-7089-9ac3-30e788b9f5b3
---
With `.svelte` frozen and new syntax in TSX, tooling of our own is optional: it serves the speed headline, not a capability.

**The baseline is not `tsc`.** `svelte-check` 4.7.7 already runs over Microsoft's native checker tsgo, and runlith's `runlith-typecheck` runs tsrs 0.18.0, oxc-project's Rust port of the TypeScript 7 compiler. What is left in JS is svelte2tsx and the glue; its share of the time is not measured.

**Plan.** Profile `svelte-check` on tsgo over Tagma's app first; only then build svelte2tsx natively on oxc's AST feeding tsrs, and publish a number against that baseline, not a promised "10x".

**TypeScript rewrite.** Upstream already types its JS with JSDoc (about 5.8k `@param`/`@returns`/`@type` tags), so the rewrite buys syntax and architecture, not safety. With no merges planned, it carries no porting tax and can happen at once.
