---
id: 01a19e73-9448-7fa1-ba9a-8d536077256f
title: Public effect, resource and external forms return disposal and keep compiled protocols internal
ord: 5
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a1877e-fd98-7ad3-8502-952177d1c74f
  - kind: relates
    to: 01a193f4-dfa5-7f9e-8a3b-1dc75f03f073
sources:
  - kind: file
    ref: packages/vigla/src/runtime/reactivity/public.ts
  - kind: symbol
    ref: packages/vigla/src/shared/external.ts
    symbol: expose
---
Libraries build on these forms instead of the compiler's internal ones: `effect(fn)`, `effect.pre(fn)` and `effect.root(fn)` are `$effect`, `$effect.pre` and `$effect.root`, each returning the function that disposes what it created; `resource(fn)` is `$derived(await …)` for code outside components — it resolves with a read-only cell once its first value exists, and each later run holds the batch that started it so the screen never mixes old and new values; `pending`, `latest` and `snapshot` are `$effect.pending`, `$state.eager` and `$state.snapshot`. The first run of a resource holds nothing: a caller that wants the screen to wait for the first value wraps the call in `hold`.

Returning the internal effect record would let a caller reach scheduler state, and returning nothing would leave a library no way to stop an effect it created outside an owner it controls; a dispose function is the whole contract. `external(read)` exposes `current`, `peek`, `refresh()` and `dispose()` only: the compiled `$store` protocol — `mutate` and `refresh` returning the value of the expression they wrap, a source name for diagnostics, a trace label — stays on the internal factory compiled code calls.

On the server none of these runs reactively, matching compiled server code: effects never run and return a no-op disposal, a resource awaits its function once while counting toward its owner's settlement, `pending` is 0 and `latest` reads its value directly. `Owner` is published as a type only, so the only way to get one is `root`, `owner.root` or `getOwner`.
