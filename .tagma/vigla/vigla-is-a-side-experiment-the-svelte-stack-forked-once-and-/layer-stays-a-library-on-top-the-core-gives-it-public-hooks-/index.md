---
id: 01a1852f-ba89-7089-9ac3-30ec57917054
title: "Layer stays a library on top: the core gives it public hooks, Kit gives it seams"
ord: 5
tags: ["idea"]
fields:
  {
    "status": "open"
  }
---
`@runlith/layer` — the app graph of keys with tiers, scopes tied to navigation, a manifest closed by types and ports filled by composition — stays a library on top of Vigla, never part of its core; it is Vigla's best first client. `@runlith/query` follows it.

**Where it lives.** For now in the tagma repository: its only consumers are there — 517 files of `apps/tagma` and the `query`, `primitives` and `i18n` packages import it (2026-10-29) — and Vigla has no code yet. It moves into Vigla's monorepo, as separate packages beside the framework, when Vigla first needs it, and moves as the one implementation: Tagma then takes it from there, so two live copies never exist. Vigla's monorepo rather than a repository of its own, because the core's public roots, Kit's seams and layer's binding change together. The move costs little: layer and query were touched by 7 of tagma's 305 commits from 2026-10-26 to 10-29, a short history.

**Moved, not rewritten.** A review of layer's core on 2026-11-08 found its work linear in keys and scopes and no reason to rewrite it; it moves as it is, with its binding changed. The weak points verified so far:
- its services live in detached roots outside the scheduler's model — fixed by Vigla's core, not by layer;
- `use()` works only during component init, inherited from Svelte's context — Vigla's core can give layer a mechanism of its own;
- a condition with no tiers is started and watched at every started scope, so its cost grows with scopes times conditions (Tagma task [[1f4828ca]]);
- every Tagma window, auxiliary ones included, boots the whole manifest eagerly, and the app uses none of layer's slicing — entries, chunk-loaded layers, deferred keys (Tagma idea [[fae266cb]]).

**Classes allowed, not required.** With `$state` fields a class is the native form of reactive state under runes, and one declaration gives key, type and implementation (207 service classes in Tagma's app on 2026-11-08). The clumsy part is `Service<Self>()('Id', { tier })` repeating the class; a function form beside classes — query's `Repo.define` already is one — gives flexibility without forcing either.

**What it needs from the framework.** Its core is framework-free behind the `WorldHooks` port (`effectRoot`, `watch`, `cell`, `start`); only its `svelte` and `sveltekit` bindings import Svelte. The binding reaches one Svelte internal, `without_reactive_context`, which hunk 01 of Tagma's Svelte patch exports; hunks 01, 02, 05 and 06 of its nine exist because its services live in detached roots the upstream scheduler does not count as its own, 05 and 06 parked while async mode is off. Vigla's core gives that publicly — detached reactive roots, owner lifetimes, scheduler guarantees for them — and layer's Vigla binding fills `WorldHooks` with public API, with no internals and no patch.

**Binding on Vigla.** `Scope` stays layer's one lifetime. Its finalizers start newest first and its close is awaited — `App.adopt` chains retirements, `readyAt` waits for them, project switching awaits `Handoff.ready` — while an `Owner` disposes synchronously, so owners cannot stand in for scopes. The Vigla binding gives each scope an owner through `WorldHooks` instead; Tagma's layer module holds the agreed spec. A service's effects and a condition's watcher are built under an application root of the scope's owner, which Vigla releases newest first as scopes do; the owner itself is disposed after the scope's awaited finalizers settle, not by a finalizer, since finalizers are started together; the current app and scope become owner context read through the core rather than component context. That puts services under the scheduler, their failures under `onError`, and `use()` within reach of any code running under an owner — never a DOM event handler, which has none. `owner.settled()` waits only for work started through `owner.start`, `hold` or compiled `await`: Door and Live calls run as Effect fibers and queries as TanStack promises, so a scope's settlement covers them only where their callers count them. Layer's suite on Vigla's Svelte adapter comes first ([[92723688]]); it proves today's binding there, not this one.

**Not in the core.** Angular puts DI in its core: every component is made by the injector, one way for big teams and a mandatory model for everyone. In Vigla it would break "the same Svelte" and force an architecture on those who came for Svelte's lightness.

**Not in Kit.** Layer is useful without Kit — a Capacitor SPA, the desktop, plain Vite.

**Kit gives seams.** The Kit fork offers first-class hooks for an app graph per request and per tab, a snapshot carried from load to the browser, and prefetching a place's chunks before navigation — replacing what `layer/sveltekit` works around today over Tagma's SvelteKit 2.70: the snapshot riding the `__layer` field of load data, SSR under `App.handle` failing on a prerendered page because it reads `url.search`, `Router.goto` refusing before the first navigation. `@vigla/kit` now has three of them: an owner per request and per tab, data carried to the browser through the core's `hydratable` store, and `preloadCode` under the tab owner; a `goto` before start waits for it. A prerendered request still refuses `url.search`, as upstream's does, so layer's server binding stops reading it.

**The official stack.** Vigla, Kit, layer and query are presented together as the stack for large apps — Angular-level coherence for those who choose it — while each part works alone.
