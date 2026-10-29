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

**Motivation.** Upstream's compiler strips types before compiling, so it decides by syntax alone. The TSX path makes typed compilation natural: the file is already TypeScript and runlith already runs a native checker (tsrs).

**Costs.** The build needs the checker, so it is slower; a native checker narrows that. Types can lie (`any`, casts), so an optimization is legal only where the type proves it.

**What would inform the choice.** Measurement first: an optimization is worth its build cost only where the milestone's benchmarks show the machinery it removes costs something.