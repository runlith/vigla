---
id: 01a18783-3b08-722c-ad34-4c99cf7901ef
title: Snippet arguments travel as thunks on the client and as values on the server
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/compiler/client/component.ts
  - kind: file
    ref: packages/vigla/src/compiler/server/component.ts
  - kind: file
    ref: packages/vigla/src/runtime/dom/swap.ts
  - kind: symbol
    ref: packages/vigla/src/compiler/client/index.ts
    symbol: client
  - kind: symbol
    ref: packages/vigla/src/compiler/server/index.ts
    symbol: server
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/snippet.ts
    symbol: snippetArgs
  - kind: symbol
    ref: packages/vigla/src/runtime/server/snippet.ts
    symbol: snippetArgs
  - kind: symbol
    ref: packages/vigla/src/shared/snippet.ts
    symbol: snippet
---
A client snippet is `(anchor, ...args)` where each argument is a function returning the current value, and a parameter's every read inside the snippet calls it, so the snippet's content follows the caller's state without the snippet being rebuilt; a parameter the caller leaves out defaults to `noop`. Server snippets run once and take plain values. The forms must not mix: `{@render}` on the client always passes thunks, and a snippet created with `createRawSnippet` follows the same shape. Its server wrapper turns plain arguments into getters for the same factory. A `{@render}` of a snippet declared in the same component and never reassigned is a direct call; any other callee, or an optional call, goes through the `render` block, which rebuilds when the snippet function changes. Optional calls substitute an empty function for a nullish callee; a required nullish callee is a DEV diagnostic. DEV invocation checks follow each runtime's argument form; native anchor branding accepts nodes from another window, and stringification fails without changing the callable's identity. Lifted protection precedes authored module code without moving unrelated template initialization ahead of it. Protection uses early script setup where the declaration shares that scope, and stays beside declarations in local fragments, preserving their lexical dependencies.