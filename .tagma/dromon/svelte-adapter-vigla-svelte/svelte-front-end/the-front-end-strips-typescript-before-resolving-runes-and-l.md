---
id: 01a1876b-826c-7ab2-a133-2e5603902608
title: The front end strips TypeScript before resolving runes and lowering
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/svelte/src/front/lower.ts
  - kind: file
    ref: packages/svelte/src/front/typescript.ts
  - kind: file
    ref: packages/svelte/src/front/diagnostics.ts
  - kind: file
    ref: packages/svelte/src/front/validate/anchors.ts
---
The public AST keeps TypeScript; the IR never carries it. Lowering strips type annotations, `as`, `satisfies`, `!`, type-only imports and exports and type declarations, as upstream's compiler does before analysis. It refuses enums, decorators, accessor fields, constructor parameter modifiers and namespaces holding values with `typescript_invalid_feature`. Lowering runs before the front end's own checks, so these errors come first, as upstream's do.

Stripping runs before rune resolution because the port keys `runes` by node identity. Stripping replaces nodes (`x as T` becomes `x`), so resolving first would key the map on objects the unit no longer holds.

Names upstream keeps as strings become positioned ESTree for the IR: a component's `ns.Widget` and a directive's dotted name (`use:a.b`, `transition:fade`) become an Identifier or member chain whose offsets point at the name in the source. An each block's index has no position in upstream's AST, so its Identifier carries none.

Lowering records which IR node each template node became. The front end's syntax diagnostics are anchored to template and script nodes, and this map moves them onto the unit's nodes for `ValidateOptions.front`. The core's walk then raises each one where it visits that node, which keeps upstream's first error and warning order. Legacy constructs the front end rejects (`on:`, `let:`, `<svelte:component>`, `<svelte:self>`, `<svelte:fragment>`) lower to nothing, because their anchored error is always raised. Message text comes from the core's catalog (`errorMessage`, `warningMessage`), apart from the few Vigla-only legacy codes that `diagnostics.ts` words itself.
