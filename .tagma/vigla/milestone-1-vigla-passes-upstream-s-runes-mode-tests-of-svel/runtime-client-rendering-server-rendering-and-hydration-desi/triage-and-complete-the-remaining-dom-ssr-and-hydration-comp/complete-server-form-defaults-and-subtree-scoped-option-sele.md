---
id: 01a1954f-76ec-7c36-b25e-933783ca2109
title: Complete server form defaults and subtree-scoped option selection
ord: 2
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19550-76a0-7977-8dfd-f6a893be5b2c",
    "status": "done"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
  - kind: relates
    to: 01a18680-7dbe-7f74-92f0-3f8330c2730c
  - kind: relates
    to: 01a18680-7dc1-7c56-81a9-8c98fa24c1dc
---
Implement the remaining server form compatibility: input/select defaults, readonly bindings, implicit and asynchronous option values through components, spread classes, and contenteditable fallback content. Selection must belong to the output subtree rather than a process-global stack, preserving concurrent renders and async descendants; keep lowering and runtime consumers together.