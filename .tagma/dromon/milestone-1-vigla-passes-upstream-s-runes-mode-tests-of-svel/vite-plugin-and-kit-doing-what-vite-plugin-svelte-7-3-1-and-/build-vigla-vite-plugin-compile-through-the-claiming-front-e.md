---
id: 01a187bd-e581-7ebe-85bb-fecb6aa3c486
title: "Build @vigla/vite-plugin: compile through the claiming front end, CSS, HMR, preprocessing and prebundling"
ord: 1
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fafe34c15e3
---
The Vite plugin half of [[e34c15e3]]: `packages/vite-plugin`, published `@vigla/vite-plugin` and installed as `@sveltejs/vite-plugin-svelte`, doing for runes code what vite-plugin-svelte 7.3.1 does, the inspector excluded. It names no front end: each file goes to the front end that claims it, and compile options pass through unchanged. Done when the vite-plugin unit and e2e entries pass on `targets/vigla` in serve, build and build-watch. Verified on the workspace plugin: 10 public unit entries, one native public-Vite regression, and 31 recorded e2e entries across six projects (20 serve, 11 build). Build-watch and the remaining projects are not yet verified; no whole e2e part was run.