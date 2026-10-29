---
id: 01a1865b-f27b-7722-bc99-e58a0cad91bd
title: Run SvelteKit's and vite-plugin-svelte's tests through the harness on targets/upstream
ord: 4
tags: ["task"]
fields:
  {
    "status": "open"
  }
---
Kit's unit specs, `test/apps` (each app's Playwright and vitest steps, dev and build, its variant scripts), `test/build-errors`, `test/prerendering`, `test/types`, the node and static adapters' tests, and vite-plugin-svelte's unit specs and e2e projects outside the inspector in each run mode, with manifest entries and statuses as [[658ccea4]] orders them — Kit apps converted to runes and compiled with async on. `targets/upstream` gains `@sveltejs/kit` 3.1.0 and `@sveltejs/vite-plugin-svelte` 7.3.1. Done when, for each, the harness passes exactly the contract entries upstream's own runners pass in the reference configuration, checked by `compare.ts`.