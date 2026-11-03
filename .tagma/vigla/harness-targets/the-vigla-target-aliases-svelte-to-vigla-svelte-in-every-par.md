---
id: 01a1868a-e2ea-72d4-960d-d085f32865f3
title: The Vigla target aliases `svelte` to `@vigla/svelte` in every part and resets nothing between samples
ord: 3
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fab49056597
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fac9d5e3831
sources:
  - kind: file
    ref: targets/vigla/fresh.ts
  - kind: file
    ref: targets/vigla/kit/package.json
  - kind: file
    ref: targets/vigla/package.json
  - kind: file
    ref: targets/vigla/vite-plugin/package.json
---
`targets/vigla` installs the workspace's `@vigla/svelte` under the name `svelte` (`"svelte": "workspace:@vigla/svelte@*"`) and `vigla` beside it, so samples, runners and compiled output importing `svelte` reach the adapter, and the adapter's entries reach the core through its published entries. Its fresh-state hook is empty on purpose: the runtime keeps no state of a tree once that tree's flush settled, so there is nothing to clear between samples, and a sample failing only after another one is a defect of that rule, not of the hook.

The `vite-plugin` and `kit` parts install the compatibility package `@vigla/vite-plugin-svelte` under `@sveltejs/vite-plugin-svelte` and the adapter under `svelte`, so the copied apps exercise the plugin under the identity third-party plugins look up, through their existing public imports. The `vite-plugin` part keeps upstream's `@sveltejs/kit` 3.1.0 for its Kit e2e projects. The `kit` part installs the compatibility package `@vigla/sveltekit` under `@sveltejs/kit`, which reaches `@vigla/kit`, and the workspace Node, Bun and static adapters under their respective `@sveltejs/adapter-*` names. Recorded entries define each adapter's checked deployment modes; alias selection alone is not app acceptance. The forcing hook also wraps the adapter's TypeScript `svelte/compiler` entry, so the parts compile with the same runes and async options as the Svelte suites.