---
id: 01a187ca-e656-7569-8564-ac0fabdaf506
title: Vite plugin `@vigla/vite-plugin`
ord: 21
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "src/index.ts"
      }
    ],
    "id": "vite-plugin",
    "kind": "surface"
  }
sources:
  - kind: dir
    ref: packages/vite-plugin
---
Builds and serves an application's components in Vite, published as `@vigla/vite-plugin` and installed under the name `@sveltejs/vite-plugin-svelte`: it finds the front ends among the app's dependencies, compiles each file through the one claiming it, serves component CSS as virtual modules, swaps components in place on edit, runs preprocessors and prebundles libraries that ship component sources. It knows no front end's syntax or compiler: what a front end claims and how it compiles stays with that front end.