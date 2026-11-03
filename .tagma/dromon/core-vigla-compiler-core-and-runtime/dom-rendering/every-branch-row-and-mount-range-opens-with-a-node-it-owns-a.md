---
id: 01a18699-30a3-7d55-8e49-bfd9feb9a9bc
title: "Every branch, row and mount range opens with a node it owns: an empty text node, an empty comment where slotting could see it, or a stable claimed node when hydrated"
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/dom/mount.ts
  - kind: file
    ref: packages/vigla/src/runtime/dom/range.ts
---
A branch, a list row or a mount is moved and removed as the node range it inserted, and a nested block inserts its content before its own anchor: when the range's leading content is a nested block, that block's arm becomes the range's first node and is replaced the next time the block switches. So `build` opens every range with an empty text node of its own and keeps it as `first`; the range's last node is always one its own template placed — a nested block's anchor at worst — so it needs no marker. Without the marker, a range whose first node had been replaced moved and removed nothing, leaving a branch's nodes behind after unmount and putting detached row nodes back on reorder.

The marker costs one empty text node per branch, row and mount, invisible to `innerHTML`; upstream samples and pages assert `innerHTML` exactly (`custom-elements/props`), so a comment everywhere would show. A Text node is slottable, though: as a direct child of a custom element or a shadow host it is assigned to the default slot, counting in `assignedNodes()` and hiding the slot's fallback. A range whose anchor stands in such an element therefore opens with an empty comment, and a range built off-screen inside it inherits that choice; a list's start node and a hydrated empty arm's or dynamic render's marker follow the same rule. The choice is made when the range is built, so a range at the root of a component's template takes the choice of the range it is built in, never of the element the template is later appended to, and a mount, which names no anchor, keeps text openers even when its target is a custom element. A hydrated range claims instead of building: it opens at the first node claimed after the stable node before it, and a block's open marker stays in the DOM as a node of the enclosing range, never of an arm, so a nested block switching later never replaces a range's first node. A dynamic `{@render}`, which the server writes inline with no open marker, inserts an empty text node of its own before its claimed content for the same reason: without it, a range led by the render opened at the snippet's node and lost it at the first switch, leaving the page's nodes behind at unmount (`snippet-reactive-args`). An arm or row the server left empty gets an empty text node inserted as its marker, as a built one has.
