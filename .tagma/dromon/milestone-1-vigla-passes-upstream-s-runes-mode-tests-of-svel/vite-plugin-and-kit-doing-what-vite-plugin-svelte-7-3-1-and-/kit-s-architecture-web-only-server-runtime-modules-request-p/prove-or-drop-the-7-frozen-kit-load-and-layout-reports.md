---
id: 01a1a144-16d3-7beb-b0da-fa7c53229bad
title: Prove or drop the 7 frozen Kit load and layout reports
ord: 4
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1a145-9631-75e3-b7dc-f36b5806ed83",
    "status": "in_work"
  }
edges:
  - kind: discovered-from
    to: 01a1863d-db39-787b-8f72-b03a2e546434
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
---
Seven frozen reports of [[2e546434]] belong to this area. Commit `0050b8630e4f342793560277fe7c61adb04e2daf` proves #11635, #9355 and #10022 through the three `own/kit/load-dependencies/test/load.test.js` entries: upstream Kit 3.1.0/Svelte 5.57.3/vite-plugin-svelte 7.3.1 fails all three, Vigla passes all three. Readiness follow-up `21aba0ce6b865d6113864df0ab8844e182414e41` replaces the mount marker with initial `afterNavigate` and permits cold dev startup; the params entry then passed on the first attempt in three consecutive fresh runs (21.7s, 13.9s and 49.4s). Four existing client dependency checks, three server-data checks and Kit tsrs pass. One Sol review found a redirect waiting behind a pending parent; its public `Server.respond` regression was red before the correction and green afterward. #14798 is dropped with the fork-base evidence below; #13787 is excluded as an accurate diagnostic outside the report's expected contract. Remaining: #5307 and #14561. M1 ([[658ccea4]]) requires each remaining report either proved by an upstream-red/Vigla-green difference sample or excluded by a recorded non-failing fork-base reproduction.

- [#5307 Redirect to child page trigger load() of parent again](https://github.com/sveltejs/kit/issues/5307) · mode-independent · [stackblitz](https://stackblitz.com/edit/sveltejs-kit-template-default-9nhxwy?file=README.md) · Later maintainer comments describe the remaining double fetch on this redirect ([1252885992](https://github.com/sveltejs/kit/issues/5307#issuecomment-1252885992), [1253497719](https://github.com/sveltejs/kit/issues/5307#issuecomment-1253497719)). The earlier "intended" remark is superseded. No fix recorded.
- [#9355 Parent Layout Data is not sent to page when invalidated by `await parent()`](https://github.com/sveltejs/kit/issues/9355) · mode-independent · [stackblitz](https://stackblitz.com/edit/sveltejs-kit-template-default-xhrebt?file=src/routes/+layout.server.ts) · Maintainer (2024-10) confirmed stale merged page data when the parent is awaited. No fix recorded.
- [#10022 Dev builds make `__data.json?x-sveltekit-invalidated=01` requests even if `+page.server*` does not export a load function](https://github.com/sveltejs/kit/issues/10022) · mode-independent · [stackblitz](https://stackblitz.com/edit/sveltejs-kit-template-default-gegmdq?file=src%2Froutes%2Fpage3%2F%2Bpage.svelte) · No maintainer reply. A 2025-05 report shows a 404 and page crash on a static SPA build.
- [#11635 Changed params does not trigger load function](https://github.com/sveltejs/kit/issues/11635) · mode-independent · [sveltelab](https://www.sveltelab.dev/md97yhs52ldziep) · Maintainer (2024-02) confirmed the missing dependency and linked a fix PR; the reporter still reproduced it on 2.5.18 (2024-07).
- [#13787 `Fetch after load has returned` uneeded warning](https://github.com/sveltejs/kit/issues/13787) · **Dropped as intended contract, 2026-11-03:** upstream Kit 3.1.0/Svelte 5.57.3/vite-plugin-svelte 7.3.1 emits the reported diagnostic. The outer load returns the nested `loadData(fetch)` promise without awaiting it, so the second fetch genuinely runs after the outer load returns. The warning is accurate; no behavior was changed. Fixture: `/Users/teunlao/.tagma-dev/scratch/01a1a145-9631-75e3-b7dc-f36b5806ed83/up/src/routes/l13787`; reproduced warning and contract exclusion recorded in [[2e546434]].
- [#14561 Regression: layout load functions no longer reflect mutations from their children](https://github.com/sveltejs/kit/issues/14561) · mode-independent · [stackblitz](https://stackblitz.com/edit/sveltejs-kit-template-default-e6chfomf?file=src%2Froutes%2F%2Bpage.server.js) · Maintainer (2025-09) said both behaviours cannot yet be kept; no decision.
- [#14798 [Async] Nested layouts + client-side nav results in page store not being populated quickly](https://github.com/sveltejs/kit/issues/14798) · **Dropped, 2026-11-03:** original `$app/stores` fails with `app_stores_removed` on Kit 3.1.0. The supported `$app/state`/runes adaptation kept four async server layout loads and universal `await parent()`: hydrated navigation rendered count 3 and setup-time count 3 immediately and after 300ms. Kit 3.1.0/Svelte 5.57.3/vite-plugin-svelte 7.3.1, forced async/runes, Chromium. Fixture and driver: `/Users/teunlao/.tagma-dev/scratch/01a1a145-9631-75e3-b7dc-f36b5806ed83/up/`; measured observations: sibling `triage-results.json`; exclusion recorded in [[2e546434]].
