---
id: 01a1a3c5-380b-74ca-9212-296ba12eb910
title: Every name the plugin shows comes from the identity its factory receives
ord: 10
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vite-plugin-svelte/src/history.ts
  - kind: file
    ref: packages/vite-plugin-svelte/src/index.ts
  - kind: file
    ref: packages/vite-plugin-svelte/src/messages.ts
  - kind: file
    ref: packages/vite-plugin-svelte/src/names.ts
  - kind: file
    ref: packages/vite-plugin/src/identity.ts
  - kind: file
    ref: packages/vite-plugin/src/index.ts
  - kind: file
    ref: packages/vite-plugin/src/log.ts
  - kind: file
    ref: packages/vite-plugin/src/messages.ts
---
`createPlugin(naming)` makes a plugin factory under one identity, generic over the options it accepts (`PluginFactory<O>`, `Options` by default). The identity's `name` gives the marker plugin, every internal plugin, the runtime-scan module id, the log prefix and debug namespace, the `plugin` field of the dev overlay's config-change error and the plugin named in the controlled-options warning; the factory carries it as `marker`. Its `names` give everything else the plugin shows: the option names `prebundleLibraries` and `experimental.disableResolveWarnings`, the HMR warnings event, the style query flag, the module meta key, the optimizer's metadata file, the packages treated as shipping no sources, and the documentation links. An entry left out is the plugin's own; a link left out is omitted from its message, and the plugin carries no link of its own.

`vigla()` is the factory under `vigla`, with the plugin's own names. `@vigla/vite-plugin-svelte`'s `svelte()` is the same plugins under `vite-plugin-svelte`, the name third-party Vite plugins and SvelteKit look up, as upstream e2e projects do for `vite-plugin-svelte:hot-update` and `vite-plugin-svelte:preprocess`, with upstream's names for every entry above. A framework composing the plugin finds its marker through the factory's `marker`, never a literal, so it works under either identity.

An identity that names an option differently is accepted under that name: inline options and the config file, at its root and inside `vitePlugin`, are read under the identity's names and handed to the plugin under its own, so messages show the name the user wrote. Upstream's history is the identity's `history`, not the plugin's: `options` runs on the merged options, still in the identity's names, before they are renamed — it is where a retired placement of an option is promoted with its warning — and `config` runs on the resolved Vite config, where another plugin's removed API is reported. The plugin itself has no history to report.

Each factory owns its log, so two identities in one process keep their own prefixes; the level stays process-wide, as Vite's `logLevel` and `DEBUG` set it. A message whose words depend on the product — how it names the config file, `Svelte compilerOptions`, the missing exports condition — takes its text from the identity's `messages`, the plugin's own wording where the identity gives none; `@vigla/vite-plugin-svelte` gives upstream's text for each, so what it shows equals upstream's word for word, while `vigla()` keeps saying "config file".
