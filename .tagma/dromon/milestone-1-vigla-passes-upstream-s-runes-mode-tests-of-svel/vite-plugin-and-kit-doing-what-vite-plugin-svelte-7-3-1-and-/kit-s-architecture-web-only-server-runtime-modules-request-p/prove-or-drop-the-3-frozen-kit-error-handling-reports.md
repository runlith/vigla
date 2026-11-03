---
id: 01a1a144-1f89-79d7-b201-adc3bb465e1a
title: Prove or drop the 3 frozen Kit error-handling reports
ord: 11
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1a145-958a-7df6-9bee-761297384b53",
    "status": "in_work"
  }
edges:
  - kind: discovered-from
    to: 01a1863d-db39-787b-8f72-b03a2e546434
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
---
Frozen Kit reports of [[2e546434]] in this area with no test and no recorded non-reproduction (3). M1 ([[658ccea4]]) needs each one either reproduced on Kit 3.1.0 / Svelte 5.57.3 and fixed with a public regression red upstream and green on Vigla (an `own/kit` difference sample, as `layout-data` does for #17383), or removed from the list with a non-failing fork-base reproduction recorded in [[2e546434]]. The research executed no Kit reproductions; each row's evidence is upstream's report as read on 2026-10-29.

- [#11676 Incorrect "Cache-Control" Error Message in SvelteKit when Protected Route has Import Issue](https://github.com/sveltejs/kit/issues/11676) · mode-independent · [repo](https://github.com/Grupo-Viteri/svelte-header-cache-bug) · Zero comments. The `setHeaders` error replaces the real import error.
- [#14678 Calling `error` in browser layout `load` function does not work](https://github.com/sveltejs/kit/issues/14678) · mode-independent · [repo](https://github.com/hyunbinseo/svelte-kit-14678) · Zero comments; the error surfaces as an uncaught promise rejection.
- [#16345 [SvelteKit 3.0.0-next.8]: In dev mode with remote functions, `+error.page` selects the wrong layout](https://github.com/sveltejs/kit/issues/16345) · kit3 (3.0.0-next.8) · [repo](https://github.com/Serator/SvelteKit-3-In-dev-mode-with-remote-functions-error.page-selects-the-wrong-layout) · Maintainer (2026-07) called it a bug against the docs; moved off the 3.0 milestone (2026-07).
