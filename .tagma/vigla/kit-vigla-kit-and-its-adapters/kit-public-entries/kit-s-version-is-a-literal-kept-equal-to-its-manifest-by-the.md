---
id: 01a1a11e-0feb-7997-a399-6d4b9ba59820
title: Kit's `VERSION` is a literal kept equal to its manifest by the `version` spec
ord: 2
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a1a11d-7386-73e6-86f6-6cfe7c6ce28a
sources:
  - kind: file
    ref: packages/kit/src/entries/index.ts
---
Node gives a JSON module only a default export, so a named `version` import from `package.json` throws once Node loads the installed entry directly, as the build's analysis worker does. A default import works but carries the whole manifest into every client bundle that imports `@sveltejs/kit`. The literal costs nothing at runtime; the recorded upstream spec `version.spec.js` fails if it drifts from `package.json`.