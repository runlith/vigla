---
id: 01a19e32-1cfa-773c-84ce-4a3495920217
title: Hydrate async structure the server wrote
ord: 7
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
---
Eleven hydrate variants fail inside `dom/mount.ts` claiming server structure: `async-fork-obsolete-ignore`, `async-if-block-unskip`, `async-later-promise-fails-first`, `async-overlap-multiple-1`…`-4`, `async-props-id`, `async-reactivity-loss-no-false-positive-1` and `-2`, `async-settled-discard`; plus `async-hydration-attribute-unchanged (hydrate)`, which misses the `data-deferred` mutation record. Find the first mismatch producer behind each failure, fix it where server output and hydration disagree, and record the variants with their source.