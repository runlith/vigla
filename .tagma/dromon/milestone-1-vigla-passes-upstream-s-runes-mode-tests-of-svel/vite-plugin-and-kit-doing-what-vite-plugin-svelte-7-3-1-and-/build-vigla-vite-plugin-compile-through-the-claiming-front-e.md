---
id: 01a187bd-e581-7ebe-85bb-fecb6aa3c486
title: "Build @vigla/vite-plugin: compile through the claiming front end, CSS, HMR, preprocessing and prebundling"
ord: 1
tags: ["task"]
fields:
  {
    "holder": "tagma:01a18754-3aa0-76c8-9776-449a21a808bb",
    "status": "in_work"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fafe34c15e3
---
The Vite plugin half of [[e34c15e3]]: `packages/vite-plugin`, published `@vigla/vite-plugin` and installed as `@sveltejs/vite-plugin-svelte`, doing for runes code what vite-plugin-svelte 7.3.1 does, the inspector excluded. It names no front end: each file goes to the front end that claims it, and compile options pass through unchanged. Done when the vite-plugin unit and e2e entries pass on `targets/vigla` in serve, build and build-watch.