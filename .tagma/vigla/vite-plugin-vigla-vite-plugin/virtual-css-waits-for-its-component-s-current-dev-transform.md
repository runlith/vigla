---
id: 01a1adce-e5a0-7444-bdc5-97226851bc9b
title: Virtual CSS waits for its component's current dev transform
ord: 11
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vite-plugin/src/plugins/load.ts
---
A dev runner can reload an inline CSS entry before the component that produced it. Vite invalidates transformed modules on a file change but retains plugin metadata, so reading that metadata immediately can freeze the previous stylesheet into the new CSS module. The CSS loader awaits the component's cached-or-current dev transform before reading its metadata, independently of client HMR or SSR entrypoint order.