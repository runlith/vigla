---
id: 01a1a11e-0feb-7997-a399-6d4b9ba59820
title: Kit's and its facade's `VERSION` are literals kept equal to their manifests
ord: 2
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a1a11d-7386-73e6-86f6-6cfe7c6ce28a
sources:
  - kind: file
    ref: packages/kit/src/entries/index.ts
  - kind: file
    ref: packages/sveltekit/src/index.ts
---
Node gives a JSON module only a default export, so a named `version` import from `package.json` throws once Node loads the installed entry directly, as the build's analysis worker does. A default import works but carries the whole manifest into every client bundle that imports `@sveltejs/kit`. The literal costs nothing at runtime. `@vigla/sveltekit` exports its own `VERSION`, upstream's, over the one it re-exports from Kit, because libraries read `@sveltejs/kit`'s `VERSION` as upstream's major; the recorded upstream spec `version.spec.js` checks that literal against the facade's `package.json` under the alias, and no test checks Kit's own.