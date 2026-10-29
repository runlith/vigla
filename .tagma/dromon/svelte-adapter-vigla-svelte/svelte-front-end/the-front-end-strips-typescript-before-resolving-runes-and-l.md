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
    ref: packages/svelte/src/front/messages.ts
  - kind: file
    ref: packages/svelte/src/front/diagnostics.ts
---
The public AST keeps TypeScript; the IR never carries it. Lowering strips type annotations, `as`, `satisfies`, `!`, type-only imports and exports and type declarations the way upstream's compiler does before analysis, and refuses enums, decorators, accessor fields, constructor parameter modifiers and namespaces with values with `typescript_invalid_feature`.

Stripping runs before rune resolution because the port keys `runes` by node identity: stripping replaces nodes (an `x as T` becomes `x`), so resolving first would key the map on objects the unit no longer holds.

Names upstream keeps as strings become positioned ESTree for the IR: a component's `ns.Widget` and a directive's dotted name (`use:a.b`, `transition:fade`) become an Identifier or member chain whose offsets point at the name in the source. An each block's index has no position in upstream's AST, so its Identifier carries none.

`messages.ts` is extracted from upstream's `messages/compile-errors` and `messages/compile-warnings` and is not edited by hand: a code with several variants picks the one whose placeholders are all given, as upstream's generated functions choose on their optional argument.
