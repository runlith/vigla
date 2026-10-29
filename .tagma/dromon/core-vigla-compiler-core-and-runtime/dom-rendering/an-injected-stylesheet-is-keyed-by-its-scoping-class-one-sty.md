---
id: 01a187a8-0798-7278-9174-f531ff326bcd
title: "An injected stylesheet is keyed by its scoping class: one `<style id>` per document or shadow root, one per server render"
ord: 4
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/dom/styles.ts
  - kind: file
    ref: packages/vigla/src/runtime/server/render.ts
---
With injection on (`css: 'injected'` or the component's own option), a compiled component carries its sheet as a module-level `{ hash, code }` and hands it to `appendStyles` at the start of every instance. The client inserts `<style id="<hash>">` into the shadow root holding the anchor, else into the document's head, unless an element with that id already stands there; the server adds the object to the render's set, and `render()` writes each sheet once into `head`, in the order components first rendered. The id is the dedupe key and the contract: hydration finds the server's `<style>` already present, and two components sharing a scoping class (a `cssHash` returning a constant) share one sheet.

The client inserts from an effect, so the anchor is in its final tree: a component built inside an off-screen branch would otherwise find the fragment as its root node and lose a shadow root it is about to enter.