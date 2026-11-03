---
id: 01a19e45-32b2-7dee-8fb9-60e417aca8b1
title: In DEV, server rendering checks element nesting across component boundaries
ord: 7
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/compiler/server/placement.ts
  - kind: file
    ref: packages/vigla/src/runtime/server/placement.ts
---
Compile-time validation sees one component, so nesting that only arises when one component's element lands inside another's — `<p><H1 /></p>` with `H1` rendering `<h1>` — is found while rendering. DEV server output brackets each element with `pushElement` and `popElement` on its output, checking the new element against its parent and every ancestor with the same rules compile-time validation uses (`shared/nesting.ts`). The open-element chain lives on the output, and a child output takes its parent's chain when it is created, so asynchronous descendants that render later are judged against the elements open where they stand, not against whatever the parent output has open by then. A boundary that recovers renders its fallback into the failing output, so recovery restores the chain the output was created with: an element whose content threw is never popped.

A finding prints `node_invalid_placement_ssr` with both source locations once per render and adds a head script logging the same text in the browser, as upstream does. Production output emits no brackets, and outside DEV an output neither initialises nor copies a chain. `<svelte:element>` is not bracketed.
