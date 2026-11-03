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
- [#17464 `svelte-kit sync` cache doesn't work](https://github.com/sveltejs/kit/issues/17464) · mode-independent · INLINE [body](https://github.com/sveltejs/kit/issues/17464#issue-5865592931) · Maintainer-authored; zero comments. Route metadata is deleted before it is read.
- [#17465 Root route $types.d.ts is deleted on every sync run](https://github.com/sveltejs/kit/issues/17465) · mode-independent · INLINE [body](https://github.com/sveltejs/kit/issues/17465#issue-5865592960) · Maintainer-authored; a contributor (2026-10) claims the fix. A claim, not a decision.
- [#10689 different generated types for ActionData based on how we return the data (directly or indirectly)](https://github.com/sveltejs/kit/issues/10689) · mode-independent · [repo branch](https://github.com/FoHoOV/svelte-template/tree/weird-type-generation) · Maintainer (2023-09) said it may duplicate #7004; the reporter disputes this. No ruling.
- [#12483 When omitting $types, the type assigned to page load differs from PageLoad](https://github.com/sveltejs/kit/issues/12483) · mode-independent · INLINE [body](https://github.com/sveltejs/kit/issues/12483#issue-2421006109) · Maintainer (2024-07) said it should error; unsure whether Kit or the language tools own it. The Kit-generated-types part is in scope.
- [#14057 `page.params.slug` throws type errors in the latest version](https://github.com/sveltejs/kit/issues/14057) · mode-independent · INLINE [body](https://github.com/sveltejs/kit/issues/14057#issue-3265650562) · Typing change from kit 2.26.1; no maintainer statement of intent.
- [#17095 sync: concurrent runs can read a truncated route_meta_data.json (JSON.parse error)](https://github.com/sveltejs/kit/issues/17095) · mode-independent · INLINE [body](https://github.com/sveltejs/kit/issues/17095#issue-5430303097) · Steps and a source excerpt, not a runnable repro. Reporter-measured (about 1 in 50); no maintainer reply.
