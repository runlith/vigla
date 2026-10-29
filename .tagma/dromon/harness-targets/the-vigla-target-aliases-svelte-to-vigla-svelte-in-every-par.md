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

Its `vite-plugin` and `kit` packages declare the same toolchain as upstream's target, with `svelte` under the same alias and no `vigla`, as an app switching by alias declares it. Bun links every package peering on `svelte` — Kit, vite-plugin-svelte, svelte-check, svelte-preprocess — to the adapter, so upstream's vite-plugin-svelte 7.3.1 and Kit 3.1.0 compile and render with Vigla until `@vigla/vite-plugin` and `@vigla/kit` replace them under the names `@sveltejs/vite-plugin-svelte` and `@sveltejs/kit`. The plugin switches in both packages at once, in the change that makes `@vigla/vite-plugin` installable, and the passing set judges the switch. The forcing hook wraps the adapter's `svelte/compiler` too, which resolves to a `.ts` source.