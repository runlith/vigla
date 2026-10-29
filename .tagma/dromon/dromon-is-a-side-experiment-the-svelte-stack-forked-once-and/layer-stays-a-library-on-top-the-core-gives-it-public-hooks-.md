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
`@runlith/layer` — the app graph of keys with tiers, scopes tied to navigation, a manifest closed by types and ports filled by composition — stays a library on top of Dromon, never part of its core; it is Dromon's best first client. `@runlith/query` follows it.

**Where it lives.** For now in the tagma repository: its only consumers are there — 517 files of `apps/tagma` and the `query`, `primitives` and `i18n` packages import it (2026-10-29) — and Dromon has no code yet. It moves into Dromon's monorepo, as separate packages beside the framework, when Dromon first needs it, and moves as the one implementation: Tagma then takes it from there, so two live copies never exist. Dromon's monorepo rather than a repository of its own, because the core's public roots, Kit's seams and layer's binding change together. The move costs little: layer and query were touched by 7 of tagma's 305 commits from 2026-10-26 to 10-29, a short history.

**Rewritten, not ported.** Everything is rewritten for Dromon, and the move is when layer is redesigned rather than copied. A verdict on its design needs reading its core (about 4.4k lines); the weak points verified so far:
- its services live in detached roots outside the scheduler's model — fixed by Dromon's core, not by layer;
- Tagma's app does not declare `Manifest`, so the type gates on `use()` are off and a wrong `use()` fails only at run time — the manifest's type promise does not hold in the main app; why it is off is not known;
- `use()` works only during component init, inherited from Svelte's context — Dromon's core can give layer a mechanism of its own.

**Classes allowed, not required.** With `$state` fields a class is the native form of reactive state under runes, and one declaration gives key, type and implementation (179 service classes in Tagma's app). The clumsy part is `Service<Self>()('Id', { tier })` repeating the class; a function form beside classes — query's `Repo.define` already is one — gives flexibility without forcing either.

**What it needs from the framework.** Its core is framework-free behind the `WorldHooks` port (`effectRoot`, `watch`, `cell`, `start`); only its `svelte` and `sveltekit` bindings import Svelte. The binding reaches one Svelte internal, `without_reactive_context`, which hunk 1 of the Svelte patch exports, and three of the four hunks carried with it (1, 2, 5, 6) exist because its services live in detached roots the upstream scheduler does not count as its own. Dromon's core gives that publicly — detached reactive roots, owner lifetimes, scheduler guarantees for them — and layer's Dromon binding fills `WorldHooks` with public API, with no internals and no patch.

**Not in the core.** Angular puts DI in its core: every component is made by the injector, one way for big teams and a mandatory model for everyone. In Dromon it would break "the same Svelte" and force an architecture on those who came for Svelte's lightness.

**Not in Kit.** Layer is useful without Kit — a Capacitor SPA, the desktop, plain Vite.

**Kit gives seams.** The Kit fork offers first-class hooks for an app graph per request and per tab, a snapshot carried from load to the browser, and prefetching a place's chunks before navigation — replacing what `layer/sveltekit` works around today over Tagma's SvelteKit 2.70: the snapshot riding the `__layer` field of load data, SSR under `App.handle` failing on a prerendered page because it reads `url.search`, `Router.goto` refusing before the first navigation.

**The official stack.** Dromon, Kit, layer and query are presented together as the stack for large apps — Angular-level coherence for those who choose it — while each part works alone.
