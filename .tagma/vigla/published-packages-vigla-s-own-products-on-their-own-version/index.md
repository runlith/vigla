---
id: 01a1a3af-44a6-74ab-9e66-720dee890210
title: "Published packages: Vigla's own products on their own versions, upstream versions only on a thin compatibility layer"
ord: 27
tags: ["spec"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
  - kind: relates
    to: 01a1a110-1ad2-7032-9301-a775dbbb75d3
---
**Outcome.** Vigla publishes its own products under their own names and versions, and a separate compatibility layer whose only job is to stand in for upstream packages under an alias. Nothing is published until this split is built.

| Package | Role | Version line |
|---|---|---|
| `vigla` | the core | own, from `0.1.0` |
| `@vigla/kit` | the application framework | own, from `0.1.0` |
| `@vigla/vite-plugin` | the Vite plugin, exporting `vigla()` | own, from `0.1.0` |
| `@vigla/adapter-node`, `-bun`, `-static` | deployment adapters of `@vigla/kit` | own, from `0.1.0` |
| `@vigla/svelte` | compatibility: the `.svelte` front end and the `svelte` API | upstream's, `5.x`, aliased as `svelte` |
| `@vigla/sveltekit` | compatibility: a thin layer over `@vigla/kit` | upstream's, `3.x`, aliased as `@sveltejs/kit` |
| `@vigla/vite-plugin-svelte` | compatibility: a thin layer over `@vigla/vite-plugin` | upstream's, `7.x`, aliased as `@sveltejs/vite-plugin-svelte` |

**Why.** An aliased package is seen by the ecosystem under the upstream name: libraries peer-depend on `@sveltejs/kit ^3` or `@sveltejs/vite-plugin-svelte ^7`, so whatever stands under that name must carry upstream's major. Carrying it on the framework and the plugin themselves would tie the numbering and the identity of Vigla's own products to Svelte's releases forever, although neither imports Svelte: the plugin finds front ends by `vigla.frontEnd` and knows no syntax, and Kit stands on the core and the plugin. Only the three compatibility packages carry upstream versions. Adapters keep their own line: nothing in the ecosystem checks an adapter's version, so an app may still alias `@sveltejs/adapter-*` to them.

**What moves where.**
- `@vigla/vite-plugin` exports `vigla()`; its Vite marker plugin is named `vigla`. `@vigla/vite-plugin-svelte` exports `svelte()` — the same plugins with the marker named `vite-plugin-svelte`, which third-party Vite plugins and SvelteKit look up — plus `vitePreprocess` and `loadSvelteConfig`, which exist only for `.svelte` sources and `svelte.config.js`.
- `@vigla/kit` takes the compiler plugin factory it composes as a parameter of its Vite plugin instead of importing `svelte()`, and finds the marker by either name. `@vigla/sveltekit` re-exports every entry of `@vigla/kit` under `@sveltejs/kit`'s export keys, owns the `svelte-kit` bin and `sveltekit()`, which passes `svelte()`, and carries SvelteKit's names and history, as [[ff420c2e]] sets out.
- Wherever Kit emits imports of itself into an application or resolves its own install, it uses the name the application installed — `@sveltejs/kit` under the alias — because under a strict install `@vigla/kit` is only a dependency of the compatibility package.
- The harness parts install the compatibility packages under the upstream names; `release` packs all nine packages with their workspace ranges pinned.

**Acceptance.**
- `pack` produces the nine packages above at the versions above, and every `@vigla/*` dependency is pinned to a sibling's version.
- An application installed from the packed tarballs under the upstream aliases, with a strict install, builds and serves: Kit's `basics` aliased build and `svelte-check` as recorded for milestone 1, and the tagma.dev landing (`apps/tagma/site` in runlith) built and prerendered.
- A plain Vite app using `vigla()` from `@vigla/vite-plugin` with the `@vigla/svelte` front end builds.
- The recorded harness entries of the vite-plugin and Kit parts stay green; the run that proves it is the operator's to allow.
