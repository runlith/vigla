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
Kit resolves its own `$app/*` modules in a `pre` plugin, so the plugin putting `$app/navigation`, `$app/paths` and `$app/forms` behind the facade's wrappers is `pre` too and listed first; it hands each wrapper's own import of the same id on to Kit, which is how the wrapper reaches Kit's module. Server environments get `$app/navigation` from a separate projection whose retired `pushState` and `replaceState` throw `server_api_unavailable` synchronously beside Kit's own server functions, as upstream's server module does; the browser wrapper's conversion and warnings never run there. The same plugin catches the absolute import of the app's `hooks.server` and `hooks.client` files that Kit's generated modules make, recognising them by the hook entries Kit's discovery resolved, which Kit's `kit:setup` plugin exposes as `api.hooks()`: a configured path with its extension, a directory's `index` file and a bare stem resolve to the very file Kit imports, so the facade re-derives none of Kit's layouts.

The plugin resolving `$app/environment`, `$app/stores` and `$env/*` must not move to `pre`: Kit's server-only guard learns which files are `$env/*/private` by resolving through the later plugins, and a `pre` history plugin ahead of it would answer first, letting browser code import `$env/static/private`.