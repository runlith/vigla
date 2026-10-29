---
id: 01a18656-c5cf-70b2-b77e-78b0ce345d6d
title: The upstream target installs svelte's dependencies at upstream's locked versions
ord: 2
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a18619-654d-70b9-aa41-2a6f0358b0e5
sources:
  - kind: file
    ref: package.json
  - kind: file
    ref: targets/upstream/package.json
  - kind: file
    ref: targets/upstream/vite-plugin/package.json
---
Equality with upstream's own runner needs the same compiler and runtime code, and part of that code is svelte's dependencies: `esrap` prints compiled output and its source maps, `acorn` parses, `devalue` serializes hydration data, `esm-env` selects `DEV`. svelte 5.57.3 declares them by caret ranges, so a fresh install resolves later patch releases than upstream's `pnpm-lock.yaml` holds, and output changes with them: under a later `esrap` the sourcemaps sample `effects` maps `$effect.pre` differently and passes only upstream. The root `package.json` therefore overrides those dependencies to upstream's locked versions.

`devalue` and `esm-env` follow SvelteKit 3.1.0's lockfile instead, at 5.9.4 and 1.2.2: Kit requires `devalue ^5.9.4`, one override cannot serve both lockfiles, and the Svelte suites keep their equality under Kit's versions. The target's `vite-plugin` package pins vite-plugin-svelte's toolchain and its e2e projects' dependencies to that repository's lockfile the same way.

Bun reads `overrides` only from the root manifest, so the pins hold for every workspace package that depends on these names, Dromon's own included. A pin moves only together with the upstream version the target installs, read from that version's lockfile.
