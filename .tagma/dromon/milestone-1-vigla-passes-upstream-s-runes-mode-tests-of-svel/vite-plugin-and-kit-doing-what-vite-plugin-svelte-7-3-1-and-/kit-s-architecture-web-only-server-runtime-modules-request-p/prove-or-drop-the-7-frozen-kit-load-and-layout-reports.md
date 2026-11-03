---
id: 01a1a144-16d3-7beb-b0da-fa7c53229bad
title: Prove or drop the 7 frozen Kit load and layout reports
ord: 4
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: discovered-from
    to: 01a1863d-db39-787b-8f72-b03a2e546434
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
---
Frozen Kit reports of [[2e546434]] in this area with no test and no recorded non-reproduction (7). M1 ([[658ccea4]]) needs each one either reproduced on Kit 3.1.0 / Svelte 5.57.3 and fixed with a public regression red upstream and green on Vigla (an `own/kit` difference sample, as `layout-data` does for #17383), or removed from the list with a non-failing fork-base reproduction recorded in [[2e546434]]. The research executed no Kit reproductions; each row's evidence is upstream's report as read on 2026-10-29.

- [#5307 Redirect to child page trigger load() of parent again](https://github.com/sveltejs/kit/issues/5307) · mode-independent · [stackblitz](https://stackblitz.com/edit/sveltejs-kit-template-default-9nhxwy?file=README.md) · Later maintainer comments describe the remaining double fetch on this redirect ([1252885992](https://github.com/sveltejs/kit/issues/5307#issuecomment-1252885992), [1253497719](https://github.com/sveltejs/kit/issues/5307#issuecomment-1253497719)). The earlier "intended" remark is superseded. No fix recorded.
- [#9355 Parent Layout Data is not sent to page when invalidated by `await parent()`](https://github.com/sveltejs/kit/issues/9355) · mode-independent · [stackblitz](https://stackblitz.com/edit/sveltejs-kit-template-default-xhrebt?file=src/routes/+layout.server.ts) · Maintainer (2024-10) confirmed stale merged page data when the parent is awaited. No fix recorded.
- [#10022 Dev builds make `__data.json?x-sveltekit-invalidated=01` requests even if `+page.server*` does not export a load function](https://github.com/sveltejs/kit/issues/10022) · mode-independent · [stackblitz](https://stackblitz.com/edit/sveltejs-kit-template-default-gegmdq?file=src%2Froutes%2Fpage3%2F%2Bpage.svelte) · No maintainer reply. A 2025-05 report shows a 404 and page crash on a static SPA build.
- [#11635 Changed params does not trigger load function](https://github.com/sveltejs/kit/issues/11635) · mode-independent · [sveltelab](https://www.sveltelab.dev/md97yhs52ldziep) · Maintainer (2024-02) confirmed the missing dependency and linked a fix PR; the reporter still reproduced it on 2.5.18 (2024-07).
- [#13787 `Fetch after load has returned` uneeded warning](https://github.com/sveltejs/kit/issues/13787) · mode-independent · [stackblitz](https://stackblitz.com/edit/sveltejs-kit-template-default-8f9xwa8z?file=src%2Froutes%2F%2Bpage.server.js) · No maintainer reply. The warning fires after both fetches are awaited.
- [#14561 Regression: layout load functions no longer reflect mutations from their children](https://github.com/sveltejs/kit/issues/14561) · mode-independent · [stackblitz](https://stackblitz.com/edit/sveltejs-kit-template-default-e6chfomf?file=src%2Froutes%2F%2Bpage.server.js) · Maintainer (2025-09) said both behaviours cannot yet be kept; no decision.
- [#14798 [Async] Nested layouts + client-side nav results in page store not being populated quickly](https://github.com/sveltejs/kit/issues/14798) · async (`experimental.async`) · [repo](https://github.com/PuruVJ/repro-async-bug-nested-layouts) · No maintainer reply; a production report (2026-04).
