---
id: 01a1a12a-bf0e-78e0-a9b0-7c25d0220e06
title: "Play outros when unmount is called with outro: true"
ord: 33
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1a12a-e2c2-7f08-aa42-854836b9022d",
    "status": "done"
  }
edges:
  - kind: discovered-from
    to: 01a1a10b-4ac8-77a9-ac7c-f18e83c53a70
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
---
`unmount(component, { outro: true })` ignores `outro`: it removes the DOM at once. Upstream plays the root's outro transitions and resolves the returned promise once they finish. The declaration in `@vigla/svelte` keeps upstream's signature, so callers already expect the behaviour. Implement it in the DOM layer's unmount path over the transitions module, with a public test red before the fix. Check whether an upstream runtime sample pins it.