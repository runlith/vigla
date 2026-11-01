---
id: 01a19546-eb68-7d45-8bc6-be087722ad46
title: Vite composes component JavaScript maps; the plugin composes virtual CSS maps
ord: 6
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vite-plugin/src/compile.ts
  - kind: file
    ref: packages/vite-plugin/src/plugins/compile.ts
---
A transform's JavaScript map refers to that transform's immediate input because Vite joins the chain afterward; passing the combined preprocess map into the compiler as well applies it twice. Extracted CSS leaves that transform chain through a virtual module, so its compiler map must be joined to preprocessing before it is handed to Vite.