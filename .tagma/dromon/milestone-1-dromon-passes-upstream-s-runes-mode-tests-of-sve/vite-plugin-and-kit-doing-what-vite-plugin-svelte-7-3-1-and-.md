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
**Vite plugin.** `@dromon/vite-plugin` does what vite-plugin-svelte 7.3.1 does for runes code: compiles `.svelte` files and `.svelte.js`/`.svelte.ts` modules, HMR, CSS, preprocessing, prebundling dependencies that ship `.svelte` sources. The inspector is out of this milestone.

**Kit.** `@dromon/kit` does what SvelteKit 3.1.0 does, its configuration in the Vite plugin as Kit 3 has it: routing, `load`, server rendering and hydration, prerendering, form actions, hooks, `$app/*` modules, env, service workers and the adapters the operator settles; remote functions per the operator's decision. Seams for an app graph such as `@runlith/layer` are designed in stage 2, not here.

**Acceptance.**
- The vite-plugin e2e contract passes.
- Kit's integration contract passes in dev and in build.
