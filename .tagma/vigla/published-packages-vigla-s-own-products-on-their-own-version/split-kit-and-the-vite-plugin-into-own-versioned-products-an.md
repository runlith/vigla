---
id: 01a1a3af-78dd-7f46-b048-b53e8bcadfa8
title: Split Kit and the Vite plugin into own-versioned products and @vigla/sveltekit, @vigla/vite-plugin-svelte compatibility layers
ord: 1
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1a3b1-660b-77a3-845d-a3a24ae6449b",
    "status": "in_work"
  }
edges:
  - kind: implements
    to: 01a1a3af-44a6-74ab-9e66-720dee890210
---
Implements [[ee890210]]: `vigla()` in `@vigla/vite-plugin`, the compiler factory as a parameter of Kit's Vite plugin, the two thin compatibility packages, Kit emitting and resolving through the installed name, own `0.1.0` versions, harness parts on the compatibility packages, `release` packing all ten.