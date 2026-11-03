---
id: 01a1941f-6f21-7363-a692-dc79f13e53b7
title: Framework virtual modules retain Kit's importer identity
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/vite/ids.ts
  - kind: file
    ref: packages/kit/src/vite/index.ts
  - kind: file
    ref: packages/kit/src/vite/modules.ts
---
Compiled framework components must resolve the core from Kit's dependencies even when the app installs Kit under an alias, so their synthetic identities stay inside Kit's package. Route-node modules belong to the app instead: their identities live under its generated client directory so Vite gives them app-relative URLs; server-published loaders use that URL form rather than filesystem paths. These identities are resolution anchors, not disk files, and dependency scanning externalizes them. Imports of Kit's published entries are emitted under the name the app installed — `@sveltejs/kit` for the facade `@vigla/sveltekit` — and resolve from the app root, because under a strict install `@vigla/kit` is only the facade's dependency and not resolvable from the app; the facade re-exports the same `@vigla/kit` files, so the app still gets one instance of Kit's runtime. The front end supplies its format through the Vite plugin API; without one, the core chooses its defaults.