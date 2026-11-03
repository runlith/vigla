---
id: 01a1a16c-6168-73d9-82a7-bde8a5262afb
title: Resolved path types cover the configured base and server-relative URLs
ord: 3
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/sync/app-types.ts
---
The same `$app/paths.resolve` declaration serves browser callers and SSR, where the default relative-path policy can return document-relative URLs. Its generated return type must cover both forms without admitting another application's base. The root contributes no extra path segment: its leading slash already comes from the resolved prefix, irrespective of the route's trailing-slash option.