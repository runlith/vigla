---
id: 01a19540-442d-73a8-8e91-0dd8d4775408
title: Run a block marked during a content effect right after that effect, as upstream orders it
ord: 16
tags: ["task"]
fields:
  {
    "holder": "tagma:01a18754-3a91-778c-bdc8-cf0239ed279a",
    "status": "in_work"
  }
edges:
  - kind: discovered-from
    to: 01a193f2-ff55-75b7-98e3-3cbacd2aed6d
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fac9d5e3831
  - kind: relates
    to: 01a1868a-e2b1-75a8-92fb-02edaa9fb09b
---
`guard-nested-if-pre` and `lifecycle-render-order-for-children-5` (runtime-runes) need Svelte 5.57.3's content-phase order: a block effect dirtied by a write made inside a content effect runs right after that effect, ancestors first, in the same batch, where [[aa9fb09b]] sends that write to the next batch. Match upstream's order without breaking an invariant of [[9d5e3831]], above all that a block never runs content of a branch its value no longer selects; correct [[aa9fb09b]] in the same change. Proof: the two entries plus the recorded runtime-runes, hydration, signals and own sets green.