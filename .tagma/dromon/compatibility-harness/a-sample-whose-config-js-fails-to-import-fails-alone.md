---
id: 01a1875f-0aa0-7df9-b865-84ef3a80e84d
title: A sample whose `_config.js` fails to import fails alone
ord: 19
tags: ["explanation"]
sources:
  - kind: file
    ref: harness/src/samples.ts
---
Configs import samples' own modules, and those import target entries: `async-store-sub-teardown` reaches `svelte/store`, `hmr-dynamic-component` `svelte/internal/client`. On a target still lacking such an entry, failing collection would take the whole suite down with one sample. So the failed import registers that sample's entries — the variants an empty config gives — as failing with the import error, and the rest of the suite runs. On upstream every config imports, so nothing changes there.