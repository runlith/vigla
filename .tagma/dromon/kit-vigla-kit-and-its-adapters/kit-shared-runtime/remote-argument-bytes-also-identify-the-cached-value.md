---
id: 01a19460-1ecc-75e0-b3eb-b1840593b379
title: Remote argument bytes also identify the cached value
ord: 3
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/shared/remote.ts
---
Query keys must agree across the browser, request cache and prerendered filenames. Canonical ordering of plain objects, Maps and Sets prevents equivalent inputs from creating different entries; transport codecs participate before that ordering. Commands preserve order and carry file bytes because their inputs are sent once rather than reused as cache identities.