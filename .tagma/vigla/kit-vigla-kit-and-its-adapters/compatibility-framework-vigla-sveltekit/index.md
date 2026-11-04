---
id: 01a1a3c1-fa09-7fac-8320-6cf71b906004
title: Compatibility framework `@vigla/sveltekit`
ord: 16
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "src/"
      }
    ],
    "id": "sveltekit",
    "kind": "surface"
  }
edges:
  - kind: imports
    to: 01a193f1-4d97-7589-b3a8-69aa6c365dd0
  - kind: imports
    to: 01a193f1-4d9c-7780-903d-88cd7526d608
  - kind: imports
    to: 01a193f1-4da0-78c5-8389-3b987555f955
  - kind: imports
    to: 01a193f7-755e-71d4-ad4c-01b08be3f25c
  - kind: imports
    to: 01a193fa-a7f2-75b1-8ead-f49c741ddad8
  - kind: imports
    to: 01a1a3c1-fa06-7690-8926-459c574270c3
sources:
  - kind: dir
    ref: packages/sveltekit
---
Stands in for `@sveltejs/kit` 3.1.0 under that alias, so an app written for SvelteKit runs on Kit with no line changed. It supplies SvelteKit's identity — `data-sveltekit-*`, `%sveltekit.*%`, `x-sveltekit-*`, `.svelte-kit`, `[sveltekit]`, `svelte.dev` diagnostic and documentation links, the `svelte-kit` command — and SvelteKit's history: `./vite` exports its own `Config`, `ExperimentalConfig` and `Framework` over `@vigla/vite-plugin-svelte`'s options, as upstream's `Config` extends its plugin's; `sveltekit()` from it reports the options SvelteKit retired with upstream's diagnostics, then returns a Vite plugin that resolves `$app/environment`, `$app/stores` and `$env/*` onto Kit's modules and diagnoses `$lib`, `$service-worker` and a `svelte.config.js`, followed by Kit built by `createKit` with that identity and `@vigla/vite-plugin-svelte`'s `svelte()`. SvelteKit's retired call forms live here too, Kit accepting only its own: `$app/navigation`, `$app/paths` and `$app/forms` resolve onto modules re-exporting Kit's with `goto` (`replaceState`, `invalidateAll`, `noScroll`, `keepFocus`), `asset` with a leading slash and `enhance`'s `update({ invalidateAll })` converted to Kit's forms under upstream's diagnostics; `pushState` and `replaceState`, which Kit lacks, are the facade's own over Kit's hook-less shallow write, as upstream keeps them outside navigation callbacks; the app's server and client hook files resolve onto modules re-exporting them with a `handleError` whose input carries upstream's warning `status` and `message` accessors in development, the root entry's `error` takes the `App.Error` body form, the configured adapter's `adapt` receives a Builder carrying upstream's removed `generateManifest` with its diagnostic (the root entry's `Builder` type declares it and `createEntries`, both retired) and a deprecated `config.kit` that warns once, the plugin warns of `+page`/`+layout` components that declare page options in their script or a layout that renders no children, `hooks` exports the retired `defineEnvVars`, which throws its move, the identity names the replaced `noscroll`/`keepfocus` link options for Kit's link reader to warn about, and its `internal/restore` entry, which Kit's generated client app imports under the installed name, supplies the restorer that captures and restores a page or layout component's exported `snapshot` with upstream's deprecation warning. Each other export key of upstream's that `@vigla/kit` has an entry for, and the `internal/client` and `internal/payload` entries Kit emits into apps under the installed name, re-exports the matching `@vigla/kit` entry, the root, `adapter`, `hooks` and `params` entries replacing the functions that read the identity with ones built over SvelteKit's identity by Kit's `internal/identity` factories, so they carry SvelteKit's names without Kit's plugin; `types/index.d.ts`, the ambient file tools read by that path, loads Kit's types, and `types/history.d.ts`, which the root entry references, types every retired form the wrappers accept; the `svelte-kit` bin runs Kit's CLI under this package's version. Its manifest field `vigla.facade` names `@vigla/kit`, by which Kit recognises the name an app installed it under. It carries upstream's version because the ecosystem peer-checks `@sveltejs/kit ^3`.