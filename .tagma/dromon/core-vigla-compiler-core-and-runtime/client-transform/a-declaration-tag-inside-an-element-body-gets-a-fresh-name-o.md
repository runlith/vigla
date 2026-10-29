---
id: 01a187ee-4172-7059-b35b-03131b0f4f08
title: A declaration tag inside an element body gets a fresh name on the client and a block on the server
ord: 4
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/compiler/client/constants.ts
  - kind: file
    ref: packages/vigla/src/compiler/server/template.ts
---
`{let …}` and `{const …}` are scoped to the fragment they stand in, and an element's body is such a fragment, so `{const doubled = 'nested'}` inside a `<div>` may shadow a `doubled` declared beside the `<div>`. The client emits an element's children as navigation and effects inside the enclosing fragment's function, where no block can wrap them without cutting the shared `content` effect off from the names, so a declaration hoisted out of an element body is declared under a name from `names.unique` and every reference to its binding is written with that name through the component's `renamed` map, which the script rewrite reads for reads, assignments and updates. The server writes children sequentially, so it flushes the buffer and puts the element's children in a real block, as upstream does on both sides.