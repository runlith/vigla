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
**Vite plugin.** `@dromon/vite-plugin` does what vite-plugin-svelte 7.3.1 does for runes code: compiles `.svelte` files and `.svelte.js`/`.svelte.ts` modules, HMR, CSS, preprocessing, prebundling dependencies that ship `.svelte` sources. It passes compile options through unchanged, so the compiler alone decides which are accepted. The inspector is out of this milestone pending the operator.

**Kit.** `@dromon/kit` does what SvelteKit 3.1.0 does, its configuration in the Vite plugin as Kit 3 has it: routing, `load`, server rendering and hydration, prerendering, form actions, hooks, `$app/*` modules, env, service workers, tracing, the adapters and remote functions as the operator settles them. Async is always on: what Kit 3.1 gates on `__SVELTEKIT_SUPPORTS_ASYNC__` is always enabled. It uses the runtime through the contract written in [[ec26636a]] and imports `parseCss` from the compiler. Seams for an app graph such as `@runlith/layer` are designed in stage 2.

**Acceptance.**
- The vite-plugin unit and e2e entries pass in every run mode in scope.
- Kit's unit, integration, build-errors, prerendering, types and adapter entries pass, the integration ones in dev and in build.
