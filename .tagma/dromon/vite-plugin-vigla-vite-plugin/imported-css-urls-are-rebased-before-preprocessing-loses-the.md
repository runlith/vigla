---
id: 01a19546-eb2f-78ac-bee0-b37d64a80647
title: Imported CSS URLs are rebased before preprocessing loses their source files
ord: 5
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vite-plugin/package.json
  - kind: file
    ref: packages/vite-plugin/src/plugins/configure.ts
  - kind: file
    ref: packages/vite-plugin/src/preprocess.ts
---
A component compiler must see imported selectors before it scopes them, while Vite's later virtual-style transform sees only the flattened CSS. The style preprocessor therefore rebases relative URLs while PostCSS declarations still identify their originating files, retaining aliases, absolute URLs and query/fragment suffixes for Vite's asset pipeline; rewriting after flattening cannot recover that provenance. The URL visitor applies only to synthetic component-preprocessing requests, so the normal CSS pipeline does not rebase them twice. The visitor is installed before Vite initializes its CSS caches. This activates Vite's PostCSS pipeline even without an app PostCSS config, and Vite consequently gives virtual style maps an absolute `file` label. That optional label differs from an unprocessed map's basename but leaves `sources` and `mappings` intact; those are the consuming source-map contract. A derived config for preprocessing alone is no way out, because Vite then falls back to one in-process preprocessor shared by every project and its first project's aliases leak into the next. Both paths retain Vite's resolved-config identity and peer-module instance: its worker pools and resolver lifetimes are attached to that object in that module, which is why the plugin's development Vite peer environment matches the target's.