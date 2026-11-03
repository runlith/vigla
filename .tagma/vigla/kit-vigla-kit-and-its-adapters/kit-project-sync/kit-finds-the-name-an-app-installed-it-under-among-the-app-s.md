---
id: 01a1a3c5-3851-78e1-910c-8c1c58674b61
title: Kit finds the name an app installed it under among the app's declared dependencies, itself or a facade declaring `vigla.facade`
ord: 4
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/sync/package.ts
  - kind: file
    ref: packages/sveltekit/package.json
---
Generated types, emitted imports and Vite's dependency lists name Kit as the app installed it, which under a strict install is the only name that resolves from the app. `installation(root)` reads the dependencies and devDependencies of the app's `package.json`, then of each ancestor's, and takes the first whose installed manifest is named `@vigla/kit` or declares `vigla.facade: "@vigla/kit"`, as the Vite plugin finds front ends by `vigla.frontEnd`. Kit therefore names no compatibility package: `@vigla/sveltekit` declares itself. Through a facade, Kit's own dependencies sit one level deeper, so Vite's nested prebundle entries go through `<name> > @vigla/kit`; directly installed, `<name>` alone. An app declaring no Kit falls back to `@vigla/kit`.

A manifest is found by walking `node_modules` directories upward rather than by `require.resolve`, because a package without a `./package.json` export cannot be resolved by its manifest path.