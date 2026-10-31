---
id: 01a187ee-7710-70a0-9265-24f4cab271de
title: Benchmarks compile one public-API source with each target's own compiler and time it in fresh processes
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: benchmarks/src/prepare.ts
  - kind: file
    ref: benchmarks/src/cli.ts
  - kind: file
    ref: benchmarks/reactivity/util.svelte.js
---
Each target compiles the benchmark modules with its own `svelte/compiler` and runs them on its own runtime. Each comparison then measures two complete implementations of one source, as an application switching by alias would see them, and never Vigla's runtime driven through upstream's internals. Upstream's reactivity benchmarks call `$.state`, `$.derived`, `$.render_effect`, `block` and `$.flush` directly; the ports use `$state.raw`, `$derived`, `$effect.pre` (upstream's `render_effect` with the user flag) inside `$effect.root`, and `flushSync`.

**Where the compiled code lives.** The compiled modules are written into the target's `.work/bench`, so a bare `svelte` in them resolves through that target's `node_modules` as it does for the harness, and a child process imports them under `browser` and `production`: `svelte` reaches its client entry and `esm-env` reports `DEV` false on both sides. A compiled module carries no async flag, so the generated index imports `svelte/internal/flags/async` wherever the target's package exports it, as upstream's own benchmark index does. Vigla is async-only and exports no flag.

**Keeping the ports faithful.** A source held in an array is a class instance with one `$state.raw` field whose initial value the field initializer reads from a module variable. Assigning the value in the constructor would make every creation a write, which opens a batch and logs a previous value on both runtimes, so the creation benchmarks would measure writes. Chains of deriveds are objects with a getter over a `$derived`, built during setup, so the timed loop pays one extra call per read on both targets. `mol` overrides a derived's `equals` upstream; the port returns the previous array when the new one is equal element by element, which stops propagation the same way.

**What is not ported.** `kairo_broad_block` and `kairo_deep_block` read their chains from `block()`, the effect behind `{#if}`, which no `.svelte.js` module can create; a port of them needs a component mounted into a document.

**Measuring.** Each measurement is one fresh process running one benchmark to its upstream-style result: the fastest of ten timed iterations after warm-up, with a forced collection before each. The runner takes ten such results per target, alternating which target goes first, and compares medians, so heap, JIT and timer state never carry from one target or benchmark into another. The machine and checkout are shared, so the runner records the starting and ending revisions and prints the load average at start and end. A result taken under load or across source changes is provisional, not a verdict.
