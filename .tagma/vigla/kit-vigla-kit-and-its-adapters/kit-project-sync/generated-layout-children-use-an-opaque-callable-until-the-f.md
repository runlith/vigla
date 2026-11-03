---
id: 01a19407-0fcf-789e-8c78-e67e169edf44
title: Generated layout children use an opaque callable until the front end supplies a snippet type
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/sync/route-types.ts
---
Kit names no front end, and the core has no source-level snippet type shared by its client and server lowering. Generated LayoutProps therefore treats children as a callable without prescribing that lowering. This remains provisional until svelte-check 4.7.7 reports the same diagnostics over the basics app on Vigla and upstream; a difference is resolved by having the front end supply its source-level snippet type through the plugin API.