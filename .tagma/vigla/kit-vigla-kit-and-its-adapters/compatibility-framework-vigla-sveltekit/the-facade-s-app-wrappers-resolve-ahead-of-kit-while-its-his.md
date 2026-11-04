---
id: 01a1a422-d8e1-7912-b136-6fb9307aa1ce
title: The facade's `$app/*` wrappers resolve ahead of Kit, while its history plugin stays behind Kit's server-only guard
ord: 1
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a1a3ed-6688-7f72-8a35-40a5ff420c2e
sources:
  - kind: file
    ref: packages/sveltekit/src/history/plugin.ts
  - kind: file
    ref: packages/sveltekit/src/vite.ts
---
Kit resolves its own `$app/*` modules in a `pre` plugin, so the plugin putting `$app/navigation`, `$app/paths` and `$app/forms` behind the facade's wrappers is `pre` too and listed first; it hands each wrapper's own import of the same id on to Kit, which is how the wrapper reaches Kit's module.

The plugin resolving `$app/environment`, `$app/stores` and `$env/*` must not move to `pre`: Kit's server-only guard learns which files are `$env/*/private` by resolving through the later plugins, and a `pre` history plugin ahead of it would answer first, letting browser code import `$env/static/private`.