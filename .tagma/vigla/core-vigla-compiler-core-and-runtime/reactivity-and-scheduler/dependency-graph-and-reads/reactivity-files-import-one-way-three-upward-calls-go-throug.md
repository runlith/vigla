---
id: 01a19eda-9efe-7287-83e1-8750d9cee391
title: Reactivity files import one way; three upward calls go through ports the higher file installs
ord: 1
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a19e67-05c0-7a6c-868c-df8ffe9e3bcf
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/batch.ts
    symbol: onFlush
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/edges.ts
    symbol: observe
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/provenance.ts
    symbol: Tracing
---
The reactivity card's floors keep every import pointing down. The batch registry sits under the tracking core, the effect tree over both, reading and derived evaluation over the effect tree, and the scheduler over reading. Three calls still run upward at runtime. Each goes through a port that the higher file fills when it loads, not through an import:
- `edges.ts` tells `effects.ts` when a derived gains its first reader or loses its last one (`observe`), so the effects its evaluation created thaw or freeze;
- `batch.ts` hands a requested microtask flush to `scheduler.ts` (`onFlush`);
- a read reports to the active trace session (`Tracing`), an object the DEV reporter in `trace.ts` creates, so the recorder `provenance.ts` imports nothing above the graph.

Keeping these calls as imports would close the files back into one cycle, which is how 19 of the 23 files stood before. A floor whose files may import each other would only hide that cycle.

Every entry that exports `flushSync` loads `scheduler.ts`. Until it loads, a requested flush does nothing.
