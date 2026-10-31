---
id: 01a1941e-31bd-7fdc-a880-1819c765c21b
title: Freeze dependencyless derived resources when their last reader leaves
ord: 13
tags: ["task"]
fields:
  {
    "holder": "tagma:01a18754-3a91-778c-bdc8-cf0239ed279a",
    "status": "done"
  }
edges:
  - kind: discovered-from
    to: 01a19403-7ea3-73b1-8c07-1c43daf51243
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
---
A dependencyless derived can retain a cached object whose owned effects hold resources. Release those resources when its last reader leaves, then resume them against the same cached object when a reader returns; rebuilding the object loses its state. The public `effect-inside-derived-frozen` runtime-runes sample currently leaves its timer callback and abort signal alive after hiding the only reader, in both DOM and hydration variants.