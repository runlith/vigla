---
id: 01a187c2-2c52-75be-b09e-a1cbc597884e
title: Head content is found by its component's filename hash, and the last-rendered title wins on the server
ord: 8
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/dom/head.ts
  - kind: file
    ref: packages/vigla/src/runtime/server/render.ts
---
The server writes each `<svelte:head>` into `render()`'s `head` between `<!--<hash>-->` and `<!---->`, the hash being the core's `hash` of the component's filename (`(unknown)` without one), so client and server compiles of one file agree. Hydration searches `document.head` for the first comment with that hash and removes it as it claims what follows, so several instances of one component take the server's head blocks in order; a component with no marker in the head (a framework that rendered body only) renders its head content fresh. Head content is moved and removed as a range ending at the closing comment or a text anchor of its own, and leaves with its component. The body cursor is saved and restored around it, so head content may sit anywhere in a template without moving the body's navigation.

`<title>` is no head content on either side. The client sets `document.title` from a user effect, after the content it reads has committed. The server keeps every title's output in render order and writes the one standing last in tree order — later sibling, or deeper — after the head content, whatever order async titles resolve in; a title whose output a failed boundary truncated drops out.