---
id: 01a19477-da88-7eab-8929-8cabd9665679
title: Assigning a derived first brings it current, so the assignment holds until a dependency changes
ord: 15
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/sources.ts
    symbol: set
---
An assignment to a derived first evaluates it if a dependency changed since its last run, or if it never ran, and only then compares and writes. Without that, the next read finds the derived stale and recomputes it, discarding the assigned value; and an assignment equal to the stale cache is mistaken for no change at all (upstream 5.57.3's defect #19057, pinned by own `derived-stale-override`). Evaluating first also subscribes a never-run derived to its dependencies, so a later write to one still replaces the assigned value. An assignment clears a failure a derived was keeping to rethrow once it publishes: at once outside a fork, at commit inside one. Inside a fork, dependency initialization uses current real values without publishing the speculative assignment. The assignment is retained in fresh fork views even when equal to the current value. Its validity records the immediate dependency values in that fork's view, independently of the real-value dependency initialisation. A later fork write or committed publication invalidates it only if those values change under their declared equality; a transitive leaf write alone is insufficient; committing a surviving assignment settles the derived after applying its dependencies so the first current read keeps the override. Upstream evaluates a dirty derived on assignment too, but compares against the cached value before doing so.