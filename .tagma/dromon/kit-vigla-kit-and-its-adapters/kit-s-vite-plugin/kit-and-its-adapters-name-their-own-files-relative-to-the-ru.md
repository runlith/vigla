---
id: 01a1a11e-0ed0-74a2-96af-87778f8f9fe4
title: Kit and its adapters name their own files relative to the running module, with its extension
ord: 15
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a1a11d-7386-73e6-86f6-6cfe7c6ce28a
sources:
  - kind: file
    ref: packages/kit/src/vite/paths.ts
  - kind: file
    ref: packages/kit/src/build/worker.ts
  - kind: file
    ref: packages/adapter-node/src/index.ts
  - kind: file
    ref: packages/adapter-bun/src/build.ts
---
The same code runs from `src/*.ts` in the workspace and from `dist/*.js` once installed, so a file Kit hands to Vite, a bundler or `fork` — the client start module, `$app/*` entries, the build worker, an adapter's runtime — is computed from `import.meta.url`. A hard-coded `src/…ts` path breaks an installed package: Node refuses to run TypeScript under `node_modules`, and Vite would load Kit's sources beside the `dist` modules the app imports, giving the app two instances of Kit's runtime whose errors and redirects fail each other's `instanceof` checks.