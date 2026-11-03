---
id: 01a187ee-7710-70a0-9265-24f4cab271de
title: Benchmarks compile one public-API source with each target's own compiler and time it in fresh processes
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: benchmarks/reactivity/util.svelte.js
  - kind: file
    ref: benchmarks/src/cli.ts
  - kind: file
    ref: benchmarks/src/prepare.ts
  - kind: file
    ref: benchmarks/compiler/compiler.bench.js
  - kind: file
    ref: benchmarks/ssr/wrapper.bench.js
  - kind: file
    ref: benchmarks/shared/time.js
  - kind: file
    ref: benchmarks/own/creation.bench.svelte.js
  - kind: file
    ref: benchmarks/reactivity/sbench.bench.svelte.js
---
Each target compiles the benchmark modules with its own `svelte/compiler` and runs them on its own runtime. Each comparison then measures two complete implementations of one source, as an application switching by alias would see them, and never Vigla's runtime driven through upstream's internals. Upstream's reactivity benchmarks call `$.state`, `$.derived`, `$.render_effect`, `block` and `$.flush` directly; the ports use `$state.raw`, `$derived`, `$effect.pre` (upstream's `render_effect` with the user flag) inside `$effect.root`, and `flushSync`.

**Where the compiled code lives.** The compiled modules, and the plain modules and components copied beside them, are written into the target's `.work/bench-<pid>`, so a bare `svelte` in them resolves through that target's `node_modules` as it does for the harness. The directory belongs to one runner process and is removed when it exits: runs started by several sessions on one checkout would otherwise rebuild a shared directory under each other's children. Each suite has its own generated index and its own export conditions, so a child loads only that suite's module graph: `reactivity` and `own` run under `browser` and `production`, where `svelte` reaches its client entry; `compiler` and `ssr` run under `production` alone, so server rendering sees `esm-env`'s `BROWSER` false as a production server does. `DEV` is false everywhere. Every suite times through the plain `shared/time.js`, and the runes helper `reactivity/util.svelte.js` keeps only reactive fixtures, so a server process never loads the client runtime. A compiled module carries no async flag, so each index imports `svelte/internal/flags/async` wherever the target's package exports it, as upstream's own benchmark index does. Vigla is async-only and exports no flag.

**Keeping the ports faithful.** A source held in an array is a class instance with one `$state.raw` field whose initial value the field initializer reads from a module variable. Assigning the value in the constructor would make every creation a write, which opens a batch and logs a previous value on both runtimes, so the creation benchmarks would measure writes. Chains of deriveds are objects with a getter over a `$derived`, built during setup, so the timed loop pays one extra call per read on both targets. `mol` overrides a derived's `equals` upstream; the port returns the previous array when the new one is equal element by element, which stops propagation the same way.

Upstream's `compiler` group calls its internal phase-one parser; the port calls the public `parse` with `modern: true`, which is that parser plus a walk deleting node metadata, whereas the default legacy format would add a whole AST conversion. Upstream has no compile benchmark: `compile_*` compiles the same three sources with the same iteration counts, runes and async forced as in the milestone's reference configuration. Upstream compiles the SSR wrapper with no options, which is legacy mode for a component using no runes; the port forces runes and async, the only mode Vigla compiles, so both targets render one meaning. As upstream does, it compiles before the timed loop.

**Deriveds nobody keeps.** `sbench_create_1to1`, `1to2`, `1to4`, `1to8` and `1to1000` create deriveds and drop them unread, as upstream's do. V8's escape analysis removes such an allocation only while nothing else receives the derived. Vigla's `derived()` passes each derived created under an owner to `ownDerived` for fork drafts, so it escapes. These entries therefore time allocations that upstream's runtime never makes, and their ratios say nothing about creating a derived an application uses. `own/create_kept_1to*` is the measure of that: it creates the same shapes, keeps every derived and reads each one from an effect per ten deriveds, as a template does. The reads go through effects because upstream subscribes a derived to its sources only once a reaction reads it. They are split ten per effect because upstream's time grows quadratically with the number of fresh deriveds one effect reads.

**What is not ported.** `kairo_broad_block` and `kairo_deep_block` read their chains from `block()`, the effect behind `{#if}`, which no `.svelte.js` module can create; a port of them needs a component mounted into a document.

**Measuring.** Each measurement is one fresh process running one benchmark to its upstream-style result: the fastest of ten timed iterations after warm-up, with a forced collection before each. The runner takes ten such results per target, alternating which target goes first, and compares medians, so heap, JIT and timer state never carry from one target or benchmark into another. The machine and checkout are shared, so the runner records the starting and ending revisions and prints the load average at start and end. A result taken under load or across source changes is provisional, not a verdict.
