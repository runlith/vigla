---
id: 01a187cb-1f04-710b-adf3-05414b5b063b
title: A hot-replaceable component swaps through the unmarked render block and keeps the first version's block
ord: 9
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/dom/hot.ts
---
With `hmr` the client output wraps each component in `hmr`. The wrapper mounts the current implementation through the same block `{@render}` uses, keyed by a source holding that implementation, so a hot update re-renders the component in place and its parent keeps its own state. The block chosen is the unmarked one, not the dynamic-component block: the server renders such a component as a plain component with no `{#if}`-style markers, and hydration must find exactly what it rendered. An update writes the incoming module's function into the first version's source and hands the incoming wrapper that same source. Each edit therefore drives the block created at first mount, instead of stacking one wrapper block per edit.