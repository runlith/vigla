---
id: 01a18795-16bc-7bbb-a2fb-750b5f07a3ba
title: State created inside a derived's run is local to it, and a derived or block writing other state throws
ord: 5
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/reactivity/tracking.ts
  - kind: file
    ref: packages/vigla/src/runtime/reactivity/sources.ts
  - kind: file
    ref: packages/vigla/src/runtime/reactivity/proxy.ts
---
A source created with `state` while a derived is computing is local to that run: reading it in the run adds no dependency and writing it there is allowed, so a derived may build and mutate its own state (`side-effect-derived-*`'s `works_*` halves); the next run treats it as any other source. A derived or a block writing any other source through `set` or a `$state` proxy outside `untrack` throws `state_unsafe_mutation`, and so does an eager effect, inside `untrack` too, since `$inspect.with` runs its callback untracked and upstream refuses a write from it. Template effects and `$effect.pre` are not guarded: upstream 5.57.3 allows a write in a plain template expression (`event-spread-rerun`) and in a pre effect, and throws for a template expression only because it compiles one containing a call into a derived (`side-effect-template`), which the code generator mirrors. Effects never create local sources: in async mode upstream localizes only under deriveds, which keeps an effect that writes state it created and read self-invalidating (the hunk 7 trap).

Locality belongs to the innermost running reaction, `untrack` included, and only to the run that created the source. Leaving reactive context for an explicit owner run, root body or teardown suspends the caller's creation scope as well as its reading: a service-created cell is an ordinary dependency when the caller reads it after returning. A derived evaluated inside that separate context still establishes its own local scope. A `$state` proxy's per-property sources and nested proxies are created lazily, so they are local only while still inside the run that created the proxy, which `local(source)` answers for its key source; created later they are plain, even inside another derived, so that derived both tracks them and is refused when it writes them. `source` creates a plain source regardless, for runtime state such as list rows, async values and pending counts, which must never vanish from a reader's dependencies. Internal writes — a block updating its own rows, an async value landing — call `write` and skip the guard.
