---
id: 01a187ee-4172-7059-b35b-03131b0f4f08
title: Element-body declarations retain fragment scope across sync and async rendering
ord: 4
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/compiler/client/constants.ts
  - kind: file
    ref: packages/vigla/src/compiler/server/template.ts
  - kind: file
    ref: packages/vigla/src/compiler/client/template.ts
---
`{let …}` and `{const …}` may shadow bindings outside their element. Synchronous declarations emitted in the enclosing client function need fresh names because those children share its update effect; the server can use a lexical block. Once an element-body declaration waits, only declarations before it may hoist: the awaited names and dependent content stay together in that element's async part, so sibling fragments and enclosing effects cannot read them before initialization.