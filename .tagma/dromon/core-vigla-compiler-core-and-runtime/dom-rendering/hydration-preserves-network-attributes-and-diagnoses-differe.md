---
id: 01a1940d-6dac-74e9-9df2-afb7864d3287
title: Hydration preserves network attributes and diagnoses different resolved URLs
ord: 15
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/dom/attributes.ts
  - kind: file
    ref: packages/vigla/src/compiler/client/element.ts
---
Resetting `src`, `srcset` or a link's `href` can start another network request, so hydration leaves the server value in place even when the client differs. DEV comparison resolves URLs against the element's document and keeps srcset descriptors significant; compiled ignore metadata suppresses the same check for direct and spread attributes.