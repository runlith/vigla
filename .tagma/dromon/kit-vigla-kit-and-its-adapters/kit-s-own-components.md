---
id: 01a193f6-64d6-7c4a-a9d2-cd17f905dd76
title: Kit's own components
ord: 6
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "index.ts"
      }
    ],
    "id": "kit-components"
  }
edges:
  - kind: imports
    to: 01a18680-7dc2-71f8-be01-915833d45c4b
sources:
  - kind: dir
    ref: packages/kit/src/components
---
The three components Kit renders itself — the root that nests an app's layouts and page under per-node error boundaries and announces navigations, the default layout and the default error page — written as template IR and compiled by `vigla/compiler` for the side and front-end format that asks, so Kit needs no front end and its markers match whatever hydrates them. Where those modules are served from is the Vite plugin's concern.