---
id: 01a1a3c5-380b-74ca-9212-296ba12eb910
title: Every name the plugin shows comes from the one name its factory receives
ord: 10
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vite-plugin-svelte/src/index.ts
  - kind: file
    ref: packages/vite-plugin/src/identity.ts
  - kind: file
    ref: packages/vite-plugin/src/index.ts
  - kind: file
    ref: packages/vite-plugin/src/log.ts
---
`createPlugin(name)` makes a plugin factory under one identity: its marker plugin, every internal plugin, the runtime-scan module id, the log prefix and debug namespace, the `plugin` field of the dev overlay's config-change error and the plugin named in the controlled-options warning all derive from that name, and the factory carries it as `marker`. `vigla()` is the factory under `vigla`; `@vigla/vite-plugin-svelte`'s `svelte()` is the same plugins under `vite-plugin-svelte`, the names third-party Vite plugins and SvelteKit look up, as upstream e2e projects do for `vite-plugin-svelte:hot-update` and `vite-plugin-svelte:preprocess`. A framework composing the plugin finds its marker through the factory's `marker`, never a literal, so it works under either identity.

Each factory owns its log, so two identities in one process keep their own prefixes; the level stays process-wide, as Vite's `logLevel` and `DEBUG` set it. Messages that name the config file say "config file", since its stem is the front end's; option names such as `prebundleSvelteLibraries` and the documentation links stay upstream's, because the options API is upstream's.