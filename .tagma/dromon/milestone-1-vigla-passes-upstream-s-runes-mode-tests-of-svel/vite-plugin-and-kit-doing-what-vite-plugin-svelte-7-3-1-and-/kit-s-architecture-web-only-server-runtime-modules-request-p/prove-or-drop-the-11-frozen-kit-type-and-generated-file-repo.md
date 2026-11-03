---
id: 01a1a144-1d82-7e3d-8e9f-a9751ae1d629
title: Prove or drop the 11 frozen Kit type and generated-file reports
ord: 9
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1a145-3d15-7649-a272-a29e4c1d872a",
    "status": "in_work"
  }
edges:
  - kind: discovered-from
    to: 01a1863d-db39-787b-8f72-b03a2e546434
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
---
Frozen Kit reports of [[2e546434]] in this area with no test and no recorded non-reproduction (11). M1 ([[658ccea4]]) needs each one either reproduced on Kit 3.1.0 / Svelte 5.57.3 and fixed with a public regression red upstream and green on Vigla (an `own/kit` difference sample, as `layout-data` does for #17383), or removed from the list with a non-failing fork-base reproduction recorded in [[2e546434]]. The research executed no Kit reproductions; each row's evidence is upstream's report as read on 2026-10-29.

- [#14295 `resolve` return value doesn’t match type / `ResolvedPathname` type is misleading](https://github.com/sveltejs/kit/issues/14295) · mode-independent · [stackblitz](https://stackblitz.com/edit/sveltejs-kit-resolve-type) · No maintainer reply. Reporter describes a breaking change in a minor release.
- [#14609 Route files’ type imports don’t work when imported via JSDoc `@import`](https://github.com/sveltejs/kit/issues/14609) · mode-independent · [stackblitz](https://stackblitz.com/edit/sveltejs-kit-template-default-sbdxvh1e?file=README.md) · Zero comments. Root-route `$types` deletion is #17465.
- [#15536 `RouteId` is not a valid param for `resolve()`](https://github.com/sveltejs/kit/issues/15536) · mode-independent · INLINE [body](https://github.com/sveltejs/kit/issues/15536#issue-4060337889) · No maintainer reply. A contributor traces the distributive `ResolveArgs` type.
- [#16437 `ResolvedPathname` allows `'//'`](https://github.com/sveltejs/kit/issues/16437) · mode-independent · INLINE [comment](https://github.com/sveltejs/kit/issues/16437#issuecomment-5025772656) · Maintainer (2026-07) traced the root special case in the generator and offered a PR; PR state unverified.
- [#17450 Layout load types remain stale when a child page gains or loses a load export](https://github.com/sveltejs/kit/issues/17450) · mode-independent · INLINE [body](https://github.com/sveltejs/kit/issues/17450#issue-5862095455) · Zero comments.
- [#17464 `svelte-kit sync` cache doesn't work](https://github.com/sveltejs/kit/issues/17464) · **Proved:** `own/kit/sync-generated` runs the public CLI twice and asserts stable root/nested declaration mtimes; Kit 3.1.0/Svelte 5.57.3/plugin 7.3.1 fails upstream, Vigla passes one entry. Commit cd836682f61dff34a77aa09f714ca4af76618e8a; Sol review found no issues.
- [#17465 Root route $types.d.ts is deleted on every sync run](https://github.com/sveltejs/kit/issues/17465) · **Proved, scoped to repeated replacement:** the same `own/kit/sync-generated` test checks the load-free root route; Kit 3.1.0 replaces it on each sync, Vigla preserves it. Commit cd836682f61dff34a77aa09f714ca4af76618e8a. Persistent absence with separately changed metadata caching was not tested.
- [#10689 different generated types for ActionData based on how we return the data (directly or indirectly)](https://github.com/sveltejs/kit/issues/10689) · mode-independent · [repo branch](https://github.com/FoHoOV/svelte-template/tree/weird-type-generation) · Maintainer (2023-09) said it may duplicate #7004; the reporter disputes this. No ruling.
- [#12483 When omitting $types, the type assigned to page load differs from PageLoad](https://github.com/sveltejs/kit/issues/12483) · mode-independent · INLINE [body](https://github.com/sveltejs/kit/issues/12483#issue-2421006109) · Maintainer (2024-07) said it should error; unsure whether Kit or the language tools own it. The Kit-generated-types part is in scope.
- [#14057 `page.params.slug` throws type errors in the latest version](https://github.com/sveltejs/kit/issues/14057) · **Dropped as a Kit 3 contract, not as a non-reproduction:** Kit 3.1.0/Svelte 5.57.3/plugin 7.3.1 plus tsrs 0.18.0 reports TS2345 for route-agnostic `page.params.slug` with `/` and `/blog/[slug]` routes, but accepts `/blog/[slug]` `PageProps.params.slug`. The former may describe `/`, which has no slug; the reporter acknowledged optionality as correct and objected to its introduction in Kit 2's minor release. Fixture and exact command are recorded in [[2e546434]].
- [#17095 sync: concurrent runs can read a truncated route_meta_data.json (JSON.parse error)](https://github.com/sveltejs/kit/issues/17095) · **Non-reproduction measured, not resolved:** on 2026-11-03, Kit 3.1.0/Svelte 5.57.3/plugin 7.3.1 with Node 26.8.1 on Darwin ran 25 cold waves of six parallel public CLI syncs (150 invocations) over root/dashboard pages and load modules; output reported `failures: 0`. The source still writes metadata non-atomically. The original fixture was subsequently expanded for #15536; this finite run does not establish absence of the rare race and is not yet a drop.
