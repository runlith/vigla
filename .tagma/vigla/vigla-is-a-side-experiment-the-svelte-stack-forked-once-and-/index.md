---
id: 01a1852f-ba89-7089-9ac3-30e6011655b8
title: "Vigla is a side experiment: the Svelte stack forked once and rewritten in TypeScript"
ord: 2
tags: ["idea"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: relates
    to: 01a1852f-ba89-7089-9ac3-30e788b9f5b3
  - kind: relates
    to: 01a1852f-ba89-7089-9ac3-30e88f3c8b43
---
**Scope.** Svelte's compiler and runtime, its tooling and SvelteKit are forked and rewritten in TypeScript with an architecture of our own — about 108k lines of upstream source before tooling ([[88b9f5b3]]). All of it lives in one monorepo; libraries of the official stack sit there as separate packages outside the core. Server rendering, hydration and Kit are designed from the start together with the client runtime and the compiler, never added later: they shape the IR, the runtime and the compiler's server output, and Svelte without Kit serves nobody — Tagma, a client-only app, runs on Kit too.

**No merges with upstream.** The fork is cut once from a frozen base — the latest releases, SvelteKit 3.1.0, Svelte 5.57.3 and vite-plugin-svelte 7.3.1, never the SvelteKit 2 Tagma still runs — and never merges upstream again; an upstream feature is taken selectively, reimplemented, only when it fits — Preact's model toward React ([[8f3c8b43]]). Compatibility is a goal plus a published list of differences, never a promise of identity.

**Compatibility is measured, not claimed.** Upstream's behavioural tests of runes mode at the fork point are the contract — legacy-mode tests are out, since Vigla compiles runes only (a later opt-in legacy layer is [[61dd69b6]]): runtime samples, validator errors and warnings, and the parser's AST where it stays upstream-shaped. Snapshots of compiled output do not transfer to another code generator. A red test is either a defect of the rewrite or an entry in the list of differences. The first milestone: every upstream test of Svelte and SvelteKit outside legacy mode green on Vigla, plus fixes, each with its own test, of the upstream defects upstream leaves open.

**Trying it on Tagma.** Switching takes the `svelte` entry of the root package catalog or a package-manager alias, plus removing `experimental.async: false` — which `@vigla/svelte` refuses — from Tagma's Svelte configs, the shared `windowCompileOptions` of the window and plugin views among them. A green Tagma branch proves only that Tagma can switch, not that Vigla is Svelte: Tagma's own components are always runes, it renders no SSR, prerenders nothing and runs with async off; scheduler defects surface by use, not by its tests. Tagma's Svelte patch is pinned to 5.57.0, below SvelteKit 3's minimum of 5.57.1, so Tagma itself runs SvelteKit 2.70 until that patch is regenerated.

**Tagma is stage 2.** Vigla replaces Svelte in Tagma on a separate branch, opened without waiting for the whole first milestone — Tagma is client-only, renders no SSR and prerenders nothing, and scheduler defects surface by use — which also moves Tagma to Kit 3; that stage also builds layer's Vigla binding over the application primitives the first milestone gives ([[8191e72f]]). On that branch async mode is on and the patch is gone by construction. Tagma's main moves once the branch shows on Tagma itself: the async-mode crash reproductions parked beside Tagma's patch green — layer's session handoff, deferred tree, time travel, rebase and branch removal, query's `single.fork`, the app's `RenderingPorts`; the layer, query, chat-ui and app suites, Tagma's typecheck, svelte-check and e2e green; layer free of framework internals ([[92723688]]); plugin views compiled with `vigla` hosted beside `svelte`, so a plugin importing either gets one runtime; and a period of the operator's own use with no scheduler fault in telemetry, since scheduler defects surface by use. Tagma and its plugins keep writing views in `.svelte` after the move: TSX is not Tagma's format. Vigla-only APIs reach Tagma's plugin SDK only after main has moved: plugins written against them run on Vigla alone. A plugin depending on a legacy-mode Svelte library compiles on upstream and fails on Vigla, which compiles runes only. The operator accepts owning the framework, as runlith already owns its foundation libraries and the Svelte scheduler patch.

**Mobile is unaffected.** Capacitor wraps any built web app — a directory of built assets with an `index.html` at its root ([Capacitor docs](https://capacitorjs.com/docs/getting-started)) — so the framework choice does not touch the mobile plan.
