---
id: 01a18783-3b08-722c-ad34-4c99cf7901ef
title: Snippet arguments travel as thunks on the client and as values on the server
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/dromon/src/compiler/client/component.ts
  - kind: file
    ref: packages/dromon/src/compiler/server/component.ts
  - kind: file
    ref: packages/dromon/src/runtime/dom/swap.ts
---
A client snippet is `(anchor, ...args)` where each argument is a function returning the current value, and a parameter's every read inside the snippet calls it, so the snippet's content follows the caller's state without the snippet being rebuilt; a parameter the caller leaves out defaults to `noop`. Server snippets run once and take plain values. The forms must not mix: `{@render}` on the client always passes thunks, and a snippet written by hand for the client (`createRawSnippet` later) follows the same shape. A `{@render}` of a snippet declared in the same component and never reassigned is a direct call; any other callee, or an optional call, goes through the `render` block, which rebuilds when the snippet function changes.