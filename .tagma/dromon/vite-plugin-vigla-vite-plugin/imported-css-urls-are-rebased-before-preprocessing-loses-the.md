---
id: 01a19546-eb2f-78ac-bee0-b37d64a80647
title: Imported CSS URLs are rebased before preprocessing loses their source files
ord: 5
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vite-plugin/src/preprocess.ts
---
A component compiler must see imported selectors before it scopes them, while Vite's later virtual-style transform sees only the flattened CSS. The style preprocessor therefore rebases relative URLs while PostCSS declarations still identify their originating files, retaining aliases, absolute URLs and query/fragment suffixes for Vite's asset pipeline; rewriting after flattening cannot recover that provenance. Its added PostCSS pass is isolated from the application's normal CSS configuration so it does not rebase those URLs twice.