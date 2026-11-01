---
id: 01a1955d-843a-7768-96b5-88246fc385da
title: Dev CSS follows the SSR transform's dependency URLs
ord: 7
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/vite/dev.ts
---
Runnable-environment imports can leave the module graph's importer links incomplete, especially for modules loaded during a universal load. Style collection therefore reads the transformed dependency URLs after rendering. Dependencies precede their importers so imported CSS cannot override the stylesheet that imported it; data-only CSS queries stay out. An inline query precedes existing parameters because Vite identifies virtual styles by their final CSS suffix.