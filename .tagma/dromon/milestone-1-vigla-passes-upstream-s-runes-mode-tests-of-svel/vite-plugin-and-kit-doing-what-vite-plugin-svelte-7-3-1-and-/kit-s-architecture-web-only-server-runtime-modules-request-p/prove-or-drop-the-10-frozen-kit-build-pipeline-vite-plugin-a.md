---
id: 01a1a144-1e7d-732c-a082-6ee8775c4211
title: Prove or drop the 10 frozen Kit build-pipeline, Vite plugin and dev-server reports
ord: 10
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
Frozen Kit reports of [[2e546434]] in this area with no test and no recorded non-reproduction (10). M1 ([[658ccea4]]) needs each one either reproduced on Kit 3.1.0 / Svelte 5.57.3 and fixed with a public regression red upstream and green on Vigla (an `own/kit` difference sample, as `layout-data` does for #17383), or removed from the list with a non-failing fork-base reproduction recorded in [[2e546434]]. The original research executed no Kit reproductions; the rows below record later fork-base measurements as they are made.

- [#10809 `static-adapter` and `vite build --watch` crashes if triggered while building.](https://github.com/sveltejs/kit/issues/10809) · mode-independent · [repo](https://github.com/RonniSkansing/svelte-vite-builld-watch-bug) · Maintainer (2023-10) said a postbuild race in fallback handling needs a concrete fix; maintainer (2025-07) asked for logs.
- [#14319 Vite dev server errors loading assets in monorepo](https://github.com/sveltejs/kit/issues/14319) · **Proved fixed:** the linked workspace font returns 403 on Kit 3.1.0 and Vigla before the fix, and 200 with the expected bytes on Vigla after; an explicit restricted filesystem allow list still returns 403 for an unrelated workspace file. Own sample `monorepo-assets`; code and passing row commit `ad1ebfe251`, manifest in `cd836682f6`.
- [#14490 [vite-plugin-svelte:load] failed to load virtual css module](https://github.com/sveltejs/kit/issues/14490) · **Dropped at the measured fork base:** Kit 3.1.0/Svelte 5.57.3/vite-plugin-svelte 7.3.1/Vite 8.3.0 served the CSS-bearing page with status 200 and its CSS when the base matched the root path prefix, on macOS (`/Users/`) and Debian Linux (`/tmp/`, app at `/tmp/app`). The reporter used Ubuntu 25.04, which was not tested. Linux fixture: `/Users/teunlao/.tagma-dev/scratch/01a1a153-aa6e-723a-af25-6fd6bcd3bc20/issue14490-linux`; macOS report: `/Users/teunlao/.tagma-dev/scratch/01a1a153-aa6e-723a-af25-6fd6bcd3bc20/issue14490-upstream/kit/own.kit.base-prefix.test-dev-1.json`.
- [#16987 src/env.ts resolves linked workspace dependencies differently from installed dependencies](https://github.com/sveltejs/kit/issues/16987) · **Reproduced, unfinished:** with a registered Node loader, native Node imports the linked dependency and reads `PUBLIC_LINKED`, while Kit 3.1.0 and Vigla both fail `svelte-kit sync` with `Cannot find module 'repro-loader-target'`. A blanket externalization would also bypass the environment runner's dependency tracking used to reload changed declarations in dev; a fix preserving that behavior remains to be proved. Upstream and Vigla reports: `/Users/teunlao/.tagma-dev/scratch/01a1a153-aa6e-723a-af25-6fd6bcd3bc20/issue16987-upstream/kit/own.kit.linked-env.test-dev-1.json` and `/Users/teunlao/.tagma-dev/scratch/01a1a153-aa6e-723a-af25-6fd6bcd3bc20/issue16987-vigla-before/kit/own.kit.linked-env.test-dev-1.json`.
- [#17506 `read` fails for assets whose URL keeps a query or hash, e.g. `?url&v=1`](https://github.com/sveltejs/kit/issues/17506) · mode-independent · INLINE [body](https://github.com/sveltejs/kit/issues/17506#issue-5961233854) · Maintainer-authored; zero comments; reproduces in dev and build.
- [#13732 CSS output does not respect Vite build target](https://github.com/sveltejs/kit/issues/13732) · **Dropped at the measured fork base:** Kit 3.1.0/Svelte 5.57.3/vite-plugin-svelte 7.3.1/Vite 8.3.0 builds the reported nested CSS as separate scoped `span` and `span:after` rules with the default browser target and no explicit `cssTarget`. Fixture: `/Users/teunlao/.tagma-dev/scratch/01a1a153-aa6e-723a-af25-6fd6bcd3bc20/issue13732-fixture`; report: `/Users/teunlao/.tagma-dev/scratch/01a1a153-aa6e-723a-af25-6fd6bcd3bc20/issue13732-upstream/kit/own.kit.css-target.test-build-1.json`.
- [#13772 Using `$env/dynamic/private` in top level might result in build error](https://github.com/sveltejs/kit/issues/13772) · mode-independent · [repo](https://github.com/Gregofi/svelte-env-vars) · Maintainer (2026-03) called the `if (!building)` workaround unfortunate and proposed static analysis; not decided.
- [#14547 Not able to use unplugin-macros with svelte kit](https://github.com/sveltejs/kit/issues/14547) · mode-independent · [stackblitz](https://stackblitz.com/edit/sveltejs-kit-template-default-varswkuh) and [stackblitz](https://stackblitz.com/edit/vitejs-vite-jnfp883g) · No maintainer reply. The two demos compare a Kit project with a vite-plugin-svelte project.
- [#14788 `experimental.async` does not apply to dependency code](https://github.com/sveltejs/kit/issues/14788) · async · [stackblitz](https://stackblitz.com/edit/p6pycmm1?file=svelte.config.js) · Zero maintainer replies. The error comes from the vite-plugin-svelte optimize step.
- [#15036 SvelteKit Vite plugin crash with remote functions and vitest 4](https://github.com/sveltejs/kit/issues/15036) · mode-independent · [repo](https://github.com/dimfeld/vitest4-remotefunctions) · No Kit maintainer reply. A contributor (2026-10) reports a Vitest 5 workaround.
