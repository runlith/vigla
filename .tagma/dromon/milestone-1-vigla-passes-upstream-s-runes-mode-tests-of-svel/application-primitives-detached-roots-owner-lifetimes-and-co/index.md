---
id: 01a18776-8e37-7bdc-93a5-7dae8191e72f
title: "Application primitives: detached roots, owner lifetimes and context outside components"
ord: 11
tags: ["spec"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: relates
    to: 01a1852f-ba89-7089-9ac3-30ec57917054
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fac9d5e3831
---
**Outcome.** An application's own structure — services living outside the component tree, scopes tied to a request, a tab or a navigation section, an app graph such as `@runlith/layer` — is built on public primitives of the core, with the guarantees components get and with no internals, patches or workarounds. The primitives are the core's, named in its own words and exported from `vigla`; Svelte's API is a projection over them that keeps upstream's restrictions for compatibility.

**Primitives.**
- **Detached roots.** A root created with no tie to the caller's reactive context — inside an effect, a branch or a component — so the branch's teardown does not destroy it, with an explicit owner instead. Its effects, deriveds and async work are scheduled, committed and awaited by `settled()` exactly as a component's are, and every invariant of [[9d5e3831]] holds for them.
- **Owners and lifetimes.** An owner holds what was created under it — roots, effects, async work, child owners — and disposing it destroys all of it at once, teardowns running. An owner can stand for any lifetime an application has: a request, a tab, a navigation section, a session.
- **Context on owners.** Context is set and read through an owner at any time — in a service, in a detached root, after an `await` — and inherited down the owner tree. `getContext` and `setContext` of `svelte` keep upstream's init-only behaviour and errors as their projection.
- **Server.** The same primitives exist per `render()` call: an owner per request, no module-level state shared between requests.

**Kit's seams**, designed with Kit in this milestone ([[e34c15e3]]): an app graph per request and per tab, a snapshot carried from `load` to the browser, and a place's chunks prefetched before navigation — so an app graph needs no workaround around data, prerendering or the first navigation.

**Acceptance.**
- `@runlith/layer`'s `WorldHooks` — `effectRoot`, `watch`, `cell`, `start` — are filled with public `vigla` API alone in a test of Vigla's own, importing nothing under `vigla/internal`.
- The traps of layer's Svelte binding in `~/runlith/tagma/packages/layer/src/svelte` — detached roots, session handoff, the deferred tree, seat release — rewritten as plain components without `@runlith/layer`, pass on Vigla in project `own`, each with its result on upstream 5.57.3 recorded.
- A service root created inside a branch outlives the branch's teardown and is destroyed with its owner; its async work holds `settled()`.
- Context set on an owner is read inside a detached root under it and after an `await`; `svelte`'s `getContext` outside initialisation still throws upstream's `lifecycle_outside_component`.
