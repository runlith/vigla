---
id: 01a19d0b-94e6-78a1-8744-37c1b06b2f90
title: Restore owner scope for async component continuations
ord: 10
tags: ["task"]
fields:
  {
    "holder": "tagma:01a18754-3a91-778c-bdc8-cf0239ed279a",
    "status": "done"
  }
edges:
  - kind: discovered-from
    to: 01a193f2-ff55-75b7-98e3-3cbacd2aed6d
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
---
Complete the dom/hydrate variants of async-derived-with-effect-and-boundary, async-effect-after-await and async-fork-discard-after-in-check. Their first failure was synchronous: generated push → script → pop still had a live component owner, but script called resumed immediately after starting its async callback, clearing that owner before pop registered deferred effects. Removing that premature reset preserves the initialization scope; later save continuations and render/error handlers retain their existing restoration, cleanup and destroyed-owner handling. No compiler, Core diagnostic, cancellation, discard or Kit fallback change is needed.

Scoped proof after a565ca31bf: all six first failed with effect_orphan, then all six passed with only this source deletion. Six passing IDs were added manually after proof. Under /Users/teunlao/.tagma-dev/scratch/01a18754-3a91-778c-bdc8-cf0239ed279a/, b06-current/svelte.json retains the six reds and b06-owner-setup/svelte.json the six greens; b06-continuation-controls/svelte.json retains 17 green owner/context/orphan/rejection/fork controls and b06-destroyed-controls/svelte.json seven green destroyed-owner, effect-timing and foreign-microtask controls. The public owners.test.ts regression from a565ca31bf and core tsrs pass. Proof is scoped shared-tree evidence, not a full runtime or committed-only run. The adjacent 20 async/fork cases, #10252 candidate, browser and performance work are outside this unit.
