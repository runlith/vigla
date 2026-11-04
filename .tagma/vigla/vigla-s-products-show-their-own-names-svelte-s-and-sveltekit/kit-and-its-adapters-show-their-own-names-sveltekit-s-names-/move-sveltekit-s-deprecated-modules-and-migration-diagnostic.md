---
id: 01a1a3ed-6688-7f72-8a35-40ac5b246205
title: Move SvelteKit's deprecated modules and migration diagnostics into @vigla/sveltekit
ord: 4
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: implements
    to: 01a1a3ed-6688-7f72-8a35-40a5ff420c2e
---
`$app/environment`, `$env/*`, `$service-worker`, `$lib` and `$app/stores`, the `svelte.config.js` and `kit`-namespace diagnostics and every other trace of SvelteKit's own history leave Kit for a Vite plugin of the facade composed before Kit's, which resolves the old modules onto Kit's and raises upstream's diagnostics.