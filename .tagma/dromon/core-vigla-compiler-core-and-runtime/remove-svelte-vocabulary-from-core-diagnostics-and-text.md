---
id: 01a19e67-05d6-7491-8554-71cbec981821
title: Remove Svelte vocabulary from core diagnostics and text
ord: 24
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e32-fb25-7109-9e5d-e26d8c51fa54",
    "status": "in_work"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
---
From the core architecture review (O6): core diagnostics and output text name Svelte (`runtime/dom/boundary.ts` around 219–229, `runtime/server/render.ts` around 505), although the core knows no Svelte and its names belong to the front end (spec ec26636a, explanation e2d9ed4c). Hand such text through the front end's runtime names or the reporter, so a native application shows nothing of Svelte, and keep upstream's exact text in the adapter where samples pin it.