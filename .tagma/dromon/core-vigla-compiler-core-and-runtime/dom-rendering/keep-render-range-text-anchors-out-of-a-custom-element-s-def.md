---
id: 01a1a13b-3b44-7d41-af52-eab67cb0da06
title: Keep render-range text anchors out of a custom element's default slot
ord: 34
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
  - kind: relates
    to: 01a18699-30a3-7d55-8e49-bfd9feb9a9bc
---
Entry: `svelte/runtime-runes/custom-element-slot-in-snippet (dom)`, contract, unrecorded. Its `(ssr)` variant passes since commit 7ce41869.

Failure: `AssertionError: expected 2 to equal 1` at `_config.js:14`, `assignedDefaultNodes.length` of the custom element's unnamed `<slot>`. `Component.svelte` renders `{@render children()}` as the only child of `<my-custom-element>`; the snippet is `Default <span slot="slot">Slotted</span>`.

Inference, not yet traced: [[feb9a9bc]] has every branch, row and mount range open with an empty Text node it owns. A Text node is slottable, so the range's opening text node is assigned to the default slot beside `Default`; upstream anchors with comments, which are not slottable. The fix belongs to how a range opens when its parent is a custom element's light DOM (or wherever slotting can observe it), without changing hydration's claimed anchors.