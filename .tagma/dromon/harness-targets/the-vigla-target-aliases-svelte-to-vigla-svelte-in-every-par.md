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
    ref: targets/vigla/package.json
  - kind: file
    ref: targets/vigla/kit/package.json
  - kind: file
    ref: targets/vigla/vite-plugin/package.json
---
`targets/vigla` installs the workspace's `@vigla/svelte` under the name `svelte` (`"svelte": "workspace:@vigla/svelte@*"`) and `vigla` beside it, so samples, runners and compiled output importing `svelte` reach the adapter, and the adapter's entries reach the core through its published entries. Its fresh-state hook is empty on purpose: the runtime keeps no state of a tree once that tree's flush settled, so there is nothing to clear between samples, and a sample failing only after another one is a defect of that rule, not of the hook.

The `vite-plugin` and `kit` parts install `@vigla/vite-plugin` under `@sveltejs/vite-plugin-svelte` and the adapter under `svelte`, so the copied apps exercise both through their existing public imports. The `kit` part installs `@vigla/kit` under `@sveltejs/kit`; its adapters stay on upstream packages until their own recorded entries pass on Vigla's adapters. The recorded passing set judges each package switch. The forcing hook also wraps the adapter's TypeScript `svelte/compiler` entry, so the parts compile with the same runes and async options as the Svelte suites.