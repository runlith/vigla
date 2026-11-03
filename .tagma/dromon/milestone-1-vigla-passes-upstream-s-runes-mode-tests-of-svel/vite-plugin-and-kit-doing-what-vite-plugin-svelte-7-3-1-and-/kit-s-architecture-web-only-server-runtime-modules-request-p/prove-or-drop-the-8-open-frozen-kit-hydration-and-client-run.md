---
id: 01a1a144-1c98-7861-b30b-fc2a16079985
title: Prove or drop the 8 open frozen Kit hydration and client-runtime reports
ord: 8
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
Frozen Kit reports of [[2e546434]] in this area with no test and no recorded non-reproduction (8). M1 ([[658ccea4]]) needs each one either reproduced on Kit 3.1.0 / Svelte 5.57.3 and fixed with a public regression red upstream and green on Vigla (an `own/kit` difference sample, as `layout-data` does for #17383), or removed from the list with a non-failing fork-base reproduction recorded in [[2e546434]]. The research executed no Kit reproductions; each row's evidence is upstream's report as read on 2026-10-29.

- [#15141 Snapshot restore causes brief UI flash with initial state value](https://github.com/sveltejs/kit/issues/15141) · mode-independent · [repo](https://github.com/mquandalle/sveltekit-snapshot-flash) · Maintainer (2026-01) guessed #14644; the reporter's downgrade still shows the flash, so the guess is refuted.
- [#16119 Chaining a $derived that depends on an awaited remote function in the script tag may cause it to rerun (practically) infinitely](https://github.com/sveltejs/kit/issues/16119) · async · [repo](https://github.com/big-mike-88/async-derived-error) · Maintainer (2026-08) said it may be fixed by svelte#18558; Svelte-owned. `frozen`.
- [#17415 Hydration waits on error-page modules the server never preloads](https://github.com/sveltejs/kit/issues/17415) · kit3 (kit 3.0.1) · INLINE [body](https://github.com/sveltejs/kit/issues/17415#issue-5815302196) · No maintainer reply. A 2026-10 measurement shows earlier hydration when the module is preloaded.
- [#9903 Declarative shadow DOM reacts strangely in sveltekit](https://github.com/sveltejs/kit/issues/9903) · mode-independent · [stackblitz](https://stackblitz.com/edit/sveltejs-kit-template-default-odfyks) · Maintainer (2023-05) asked for a repro of the flash; no decision.
- [#13631 Page crashes upon refresh](https://github.com/sveltejs/kit/issues/13631) · runes · [stackblitz](https://stackblitz.com/edit/sveltejs-kit-template-default-scix6sg7?file=src%2Froutes%2F%2Bpage.svelte) · Maintainer (2025-03) suspects a cyclic import; the regression claim is unverified.
- [#14031 `$inspect` can cause an error in `$derived` based on `data`](https://github.com/sveltejs/kit/issues/14031) · **Dropped, 2026-11-03:** on Kit 3.1.0/Svelte 5.57.3/vite-plugin-svelte 7.3.1 with forced runes/async in Chromium, hydrated the five-item server page with derived filtering and child `$inspect`, then clicked an item to the data-less root. Navigation completed without a page error through the following 300ms. Fixture/driver: `/Users/teunlao/.tagma-dev/scratch/01a1a145-9631-75e3-b7dc-f36b5806ed83/up/`; measured output: sibling `triage-results.json`. The report's supplied filter/inspect scenario is excluded in [[2e546434]].
- [#14550 Firefox Android page title disappears](https://github.com/sveltejs/kit/issues/14550) · mode-independent · [repo](https://github.com/hyunbinseo/svelte-kit-14550) · No maintainer reply; browser-specific.
- [#13506 Mobile Safari hydration mismatch due to icon](https://github.com/sveltejs/kit/issues/13506) · runes · [repo](https://github.com/Sillyvan/mobile-safari-hydration-mismatch) · No maintainer reply. A minimal repository exists; shared Safari hydration may overlap Svelte #17357.
