---
id: 01a19e61-2254-794c-a0fb-2fcd0b6af6eb
title: The hyphenated SVG and MathML names the custom-elements spec reserves are never treated as custom elements
ord: 3
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a19e56-888b-7dd0-9f94-24c8fa19bad7
sources:
  - kind: symbol
    ref: packages/vigla/src/shared/html.ts
    symbol: isCustomTag
---
A custom element gets its attributes at runtime, through properties when it defines setters, instead of from the template, so the compiler and the runtime decide custom-ness once, with `isCustomTag`: a hyphenated name other than `annotation-xml`, `color-profile`, `font-face`, `font-face-src`, `font-face-uri`, `font-face-format`, `font-face-name` and `missing-glyph`, which the HTML spec reserves because SVG and MathML already define them, or an element with `is`. Treated as custom, `annotation-xml` loses its static `encoding` from the template: the HTML parser then does not see an HTML integration point and moves HTML children such as `<p>` out of `<math>`, and the tree form builds them in the MathML namespace. Upstream 5.57.3 treats every hyphenated name as custom (own samples `reserved-custom-names` and `reserved-custom-names-tree`). Template validation keeps upstream's hyphen test, since its diagnostics are pinned.