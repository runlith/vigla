---
id: 01a193d2-513d-728f-86f4-01210a0dd463
title: Each front end supplies its own runtime format names
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/shared/format.ts
---
Format names belong to the app that produced the tree: metadata properties, version-disclosure globals, component CSS wrappers, hydration-data globals and the Trusted Types policy name use native names by default; a format that names no policy uses the native one. An adapter supplies its format per compile and per render, mount or hydrate call, so one runtime can serve several front ends without changing another tree's names.