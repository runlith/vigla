---
id: 01a18699-30a3-7d55-8e49-bfd9feb9a9bc
title: Every branch, row and mount range opens with an empty text node it owns
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/dromon/src/runtime/dom/range.ts
  - kind: file
    ref: packages/dromon/src/runtime/dom/mount.ts
---
A branch, a list row or a mount is moved and removed as the node range it inserted, and a nested block inserts its content before its own anchor: when the range's leading content is a nested block, that block's arm becomes the range's first node and is replaced the next time the block switches. So `build` opens every range with an empty text node of its own and keeps it as `first`; the range's last node is always one its own template placed — a nested block's anchor at worst — so it needs no marker. Without the marker, a range whose first node had been replaced moved and removed nothing, leaving a branch's nodes behind after unmount and putting detached row nodes back on reorder.

The marker costs one empty text node per branch, row and mount, invisible to `innerHTML`; hydration, once built, has to claim it or replace it with the server's block markers.
