---
id: 01a1852f-ba89-7089-9ac3-30eb124f400a
title: Compile TSX components with the type checker's facts
ord: 1
tags: ["idea"]
fields:
  {
    "status": "open"
  }
---
**Question.** Can the compiler ask the type checker what a value is and skip reactive machinery the types rule out — a prop typed as a string literal needs no effect, a `readonly` array that is never reassigned needs no tracked each?

**Motivation.** Svelte strips types before compiling and Solid compiles by syntax; as far as known, no framework compiles components by their types. The TSX path makes it natural: the file is already TypeScript and runlith already runs a native checker (tsrs).

**Costs.** The build needs the checker, so it is slower; a native checker narrows that. Types can lie (`any`, casts), so an optimization is legal only where the type proves it.

**What would inform the choice.** A benchmark of our own first. Compiled fine-grained frameworks already render close to plain JS (recalled from js-framework-benchmark, not measured here), so the headroom is more likely in bundle size, compile speed, SSR and hydration than in rendering. No "faster than Svelte or Solid" claim before that measurement.
