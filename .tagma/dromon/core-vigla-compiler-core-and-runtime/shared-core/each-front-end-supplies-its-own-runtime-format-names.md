---
id: 01a193d2-513d-728f-86f4-01210a0dd463
title: Each front end supplies its own runtime format names
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/shared/format.ts
---
Compile format names belong to the app that produced the code: metadata properties, version-disclosure globals and component CSS wrappers use native names by default, while an adapter supplies its own names for each compile. Sharing one runtime therefore cannot make a native tree adopt an adapter's names or let one adapter change another tree's format.