---
id: 01a185b6-09f2-796e-90b2-9fafe34c15e3
title: Vite plugin and Kit doing what vite-plugin-svelte 7.3.1 and SvelteKit 3.1.0 do for runes code
ord: 6
tags: ["spec"]
fields:
  {
    "status": "open"
  }
---
**Vite plugin.** `@vigla/vite-plugin`, installed under the alias `@sveltejs/vite-plugin-svelte`, does what vite-plugin-svelte 7.3.1 does for runes code: HMR, CSS, preprocessing, prebundling dependencies that ship component sources. It compiles each file through the front end that claims it — `.svelte` and `.svelte.js`/`.svelte.ts` through `@vigla/svelte` when the app has it — and names no front end itself. It passes compile options through unchanged, so the compiler alone decides which are accepted. The inspector is out of this milestone pending the operator.

**Kit.** `@vigla/kit`, installed under the alias `@sveltejs/kit`, does what SvelteKit 3.1.0 does, its configuration in the Vite plugin as Kit 3 has it: routing, `load`, server rendering and hydration, prerendering, form actions, hooks, `$app/*` modules, env, service workers, tracing, the adapters and remote functions as the operator settles them. Async is always on: what Kit 3.1 gates on `__SVELTEKIT_SUPPORTS_ASYNC__` is always enabled. It imports the core `vigla` and uses the runtime through the contract written in [[ec26636a]]; route components come in any form the Vite plugin compiles, and the components Kit generates itself are emitted as compiled code against the core runtime, so Kit depends on no front end. Seams for an app graph such as `@runlith/layer` — an app graph per request and per tab, a snapshot carried from `load` to the browser, a place's chunks prefetched before navigation — are designed with Kit in this milestone ([[8191e72f]]).

**Acceptance.**
- The vite-plugin unit and e2e entries pass in every run mode in scope.
- Kit's unit, integration, build-errors, prerendering, types and adapter entries pass, the integration ones in dev and in build.
