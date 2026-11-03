---
id: 01a1a11e-0d86-7340-b65b-622a9299b67e
title: A package's published manifest is derived when it is packed; its workspace manifest keeps `src` targets
ord: 1
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a1a11d-7004-7f98-84fd-f977f9431615
sources:
  - kind: file
    ref: release/src/manifest.ts
  - kind: file
    ref: release/src/pack.ts
  - kind: file
    ref: release/tsconfig.package.json
---
The workspace runs every package from its TypeScript sources — the harness, Vite and Node's type stripping load `src/*.ts` directly, with no build step — while an installed package must load JavaScript: Node refuses to strip types under `node_modules`. `bun pm pack` ignores `publishConfig`, so `pack` writes the published manifest into a staged copy instead: a target `./src/X.ts` becomes `./dist/X.js`, or `./dist/X.d.ts` under a `types` condition, and any other target passes unchanged; a package's `release.exports` adds conditions to a key right after its `types`, for artifacts that exist only once built, such as `@vigla/svelte`'s CommonJS compiler; `workspace:` ranges are pinned to the sibling's version. The staged copy holds the package's `files` without tests, and packing refuses a manifest naming a target that copy lacks.

`dist` mirrors `src` at the same depth so that every path a module computes from its own location — sourcemap and declaration-map sources, `/// <reference path>`, `../../package.json` — lands on the same file from either tree.