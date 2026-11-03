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
Frozen Kit reports of [[2e546434]] in this area with no test and no recorded non-reproduction (10). M1 ([[658ccea4]]) needs each one either reproduced on Kit 3.1.0 / Svelte 5.57.3 and fixed with a public regression red upstream and green on Vigla (an `own/kit` difference sample, as `layout-data` does for #17383), or removed from the list with a non-failing fork-base reproduction recorded in [[2e546434]]. The research executed no Kit reproductions; each row's evidence is upstream's report as read on 2026-10-29.

- [#10809 `static-adapter` and `vite build --watch` crashes if triggered while building.](https://github.com/sveltejs/kit/issues/10809) · mode-independent · [repo](https://github.com/RonniSkansing/svelte-vite-builld-watch-bug) · Maintainer (2023-10) said a postbuild race in fallback handling needs a concrete fix; maintainer (2025-07) asked for logs.
- [#14319 Vite dev server errors loading assets in monorepo](https://github.com/sveltejs/kit/issues/14319) · mode-independent · [repo](https://github.com/maxpatiiuk/svelte-monorepo-serve-error) · Zero comments. Kit's `server.fs.allow` omits symlinked packages.
- [#14490 [vite-plugin-svelte:load] failed to load virtual css module](https://github.com/sveltejs/kit/issues/14490) · mode-independent · [tarball](https://github.com/user-attachments/files/22447603/my-app.tar.gz) · Maintainer (2026-05) could not reproduce on macOS; testing on Ubuntu pending. The reporter says it is still present.
- [#16987 src/env.ts resolves linked workspace dependencies differently from installed dependencies](https://github.com/sveltejs/kit/issues/16987) · mode-independent · [repo](https://github.com/ageorgeh/sveltekit-sync-repro) · No maintainer reply. Kit's internal env Vite server runs with `configFile: false`.
- [#17506 `read` fails for assets whose URL keeps a query or hash, e.g. `?url&v=1`](https://github.com/sveltejs/kit/issues/17506) · mode-independent · INLINE [body](https://github.com/sveltejs/kit/issues/17506#issue-5961233854) · Maintainer-authored; zero comments; reproduces in dev and build.
- [#13732 CSS output does not respect Vite build target](https://github.com/sveltejs/kit/issues/13732) · mode-independent · INLINE [body](https://github.com/sveltejs/kit/issues/13732#issue-3012521855) · No maintainer reply. Vanilla Vite honours `build.cssTarget`; the Svelte-compiled CSS does not.
- [#13772 Using `$env/dynamic/private` in top level might result in build error](https://github.com/sveltejs/kit/issues/13772) · mode-independent · [repo](https://github.com/Gregofi/svelte-env-vars) · Maintainer (2026-03) called the `if (!building)` workaround unfortunate and proposed static analysis; not decided.
- [#14547 Not able to use unplugin-macros with svelte kit](https://github.com/sveltejs/kit/issues/14547) · mode-independent · [stackblitz](https://stackblitz.com/edit/sveltejs-kit-template-default-varswkuh) and [stackblitz](https://stackblitz.com/edit/vitejs-vite-jnfp883g) · No maintainer reply. The two demos compare a Kit project with a vite-plugin-svelte project.
- [#14788 `experimental.async` does not apply to dependency code](https://github.com/sveltejs/kit/issues/14788) · async · [stackblitz](https://stackblitz.com/edit/p6pycmm1?file=svelte.config.js) · Zero maintainer replies. The error comes from the vite-plugin-svelte optimize step.
- [#15036 SvelteKit Vite plugin crash with remote functions and vitest 4](https://github.com/sveltejs/kit/issues/15036) · mode-independent · [repo](https://github.com/dimfeld/vitest4-remotefunctions) · No Kit maintainer reply. A contributor (2026-10) reports a Vitest 5 workaround.
