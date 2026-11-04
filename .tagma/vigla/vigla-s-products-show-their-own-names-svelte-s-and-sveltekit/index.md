---
id: 01a1a3ed-6688-7f72-8a35-40a5ff420c2e
title: Vigla's products show their own names; Svelte's and SvelteKit's names and history live only in the compatibility packages
ord: 29
tags: ["spec"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: relates
    to: 01a1852f-ba89-7089-9ac3-30ea8cd5da81
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
  - kind: relates
    to: 01a1a3af-44a6-74ab-9e66-720dee890210
---
**Outcome.** Vigla's own products — `vigla`, `@vigla/vite-plugin`, `@vigla/kit` and `@vigla/adapter-*` — show themselves under their own names, and no file of theirs names Svelte. Every name of Svelte, vite-plugin-svelte or SvelteKit, and every piece of their history, lives in the compatibility package that stands in for that upstream: `@vigla/svelte`, `@vigla/vite-plugin-svelte`, `@vigla/sveltekit`. A compatibility package hands its upstream's names to the product it wraps; the product's code is the same under either.

**Why.** Kit was written as an implementation of SvelteKit 3.1's contract, installed under the alias `@sveltejs/kit`, so SvelteKit's names were written straight into its code; the package split moved names and versions of packages but not the names inside them. An application written for Vigla — and every TSX application — would then carry `data-sveltekit-*`, `.svelte-kit`, `x-sveltekit-*` headers and SvelteKit's migration errors. Applications written for SvelteKit carry these names in their own code — `%sveltekit.head%` in `app.html`, `data-sveltekit-reload` on a link, `process.on('sveltekit:shutdown')` — so the facade must keep them for the drop-in promise: a package swapped under an alias, no line of the app changed.

**What a product's names are.** Four kinds, each with its own place:
1. *Internal names nobody outside the code sees* — build-time constants (`__SVELTEKIT_*`), bundle and chunk names, synthetic module ids, internal origins, files Kit writes for itself. They become the product's own names, with no parameter.
2. *The visible contract carrying a brand* — link attributes, template placeholders, request and response headers, reserved query parameters and content types of Kit's client–server protocol, the output directory, the dev assets path, the announcer id, the trusted-types policy, tracing names, browser storage keys, the adapters' shutdown event, diagnostic links and prefixes, the product and plugin-function names in messages, the CLI usage line, the package names libraries depend on Kit under. These form the product's **identity**: one value whose type the product declares. The product's own identity spells them with `vigla` (`data-vigla-*`, `%vigla.head%`, `x-vigla-*`, `.vigla`, `vigla.load`, `vigla:shutdown`); its diagnostics carry their code without a documentation link until Vigla documents them. The compatibility package supplies upstream's identity.
3. *Upstream's history* — modules upstream deprecated or removed (`$app/environment`, `$env/*`, `$service-worker`, `$lib`, `$app/stores`), migration diagnostics (`svelte.config.js` no longer used, the `kit` namespace, removed options), deprecation warnings of upstream APIs. A product at `0.1.0` has none of this history, so it moves into the compatibility package as a Vite plugin composed before Kit's, which resolves the old modules onto Kit's and raises upstream's diagnostics.
4. *Conventions without a brand* — `$app/*`, the `+page`/`+layout`/`+server`/`+error` route files, `load`, actions and the configuration's shape — are Kit's own contract and stay the same under both identities. Moving from `@vigla/sveltekit` to `@vigla/kit` therefore renames the identity's names in the app and changes nothing else.

**How the identity reaches the code.**
- Kit is built by `createKit(identity, factory)`, as the Vite plugin is by `createPlugin`: `@vigla/kit/vite` exports `kit` under Kit's own identity and the `vigla` plugin factory; `@vigla/sveltekit/vite` exports `sveltekit` under SvelteKit's identity and the `svelte` factory of `@vigla/vite-plugin-svelte`. Kit's configuration type takes the options of the factory it composes, so `sveltekit({...})` accepts upstream's plugin options and `kit({...})` Vigla's.
- Build-time code — the Vite plugin, sync, build, prerendering — receives the identity as a value. Runtime code — the client router, the server — receives it as build-time constants through Vite's `define`, the channel that already carries Kit's configuration into the runtime: no lookup, no cost, unused names dropped by the bundler. Adapters take it from the Builder.
- The Vite plugin's identity grows from one name to every name the plugin shows: its options (`prebundleSvelteLibraries` and the `experimental` flags), the HMR warnings event, the style query marker, the module meta key, the optimizer's metadata file, the list of upstream packages it treats specially, documentation links. `@vigla/vite-plugin-svelte` supplies upstream's identity and accepts upstream's option names.

**Owners touched.** Kit and its parts under [[c301208d]], the adapters, the facade [[1b906004]], the plugin [[abdaf506]] and its compatibility plugin [[574270c3]]; the explanations stating the current split — [[a12eb910]], [[58674b61]], [[f13e53b7]] — are corrected with the change that breaks them. TSX ([[8cd5da81]]) is not part of this; it relies on it, since a TSX application uses Kit's own identity.

**Acceptance.**
- The rule that the products name nothing of Svelte is enforced at gate by `products-name-no-svelte` and holds no debt.
- An application composed with `kit()` renders and answers under Kit's own identity: its link attributes, template placeholders, headers and output directory, proved by Kit's own tests through its public operations.
- Through the facades, the recorded upstream entries of Kit, its adapters and vite-plugin-svelte stay green: unit entries the change touches in the work itself; the whole Kit and vite-plugin parts in a run the operator allows.
- The tagma.dev landing (`apps/tagma/site` in runlith), installed through the facades, builds, prerenders and hydrates with no edit; a live check the operator allows.
