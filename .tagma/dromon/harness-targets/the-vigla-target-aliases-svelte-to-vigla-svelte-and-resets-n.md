---
id: 01a1868a-e2ea-72d4-960d-d085f32865f3
title: The Vigla target aliases `svelte` to `@vigla/svelte` and resets nothing between samples
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
---
`targets/vigla` installs the workspace's `@vigla/svelte` under the name `svelte` (`"svelte": "workspace:@vigla/svelte@*"`) and `vigla` beside it, so samples, runners and compiled output importing `svelte` reach the adapter, and the adapter's entries reach the core through its published entries. Its fresh-state hook is empty on purpose: the runtime keeps no state of a tree once that tree's flush settled, so there is nothing to clear between samples, and a sample failing only after another one is a defect of that rule, not of the hook.
