---
id: 01a19e5c-e240-72f5-94ec-92093bfb34d9
title: Stop treating hyphenated SVG and MathML element names as custom elements
ord: 33
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: discovered-from
    to: 01a19e32-1cfa-773c-84ce-4a35a0d446ca
sources:
  - kind: symbol
    ref: packages/vigla/src/compiler/client/element.ts
    symbol: elementPart
---
`elementPart` (packages/vigla/src/compiler/client/element.ts) marks any element whose name holds a hyphen as custom, so `annotation-xml` and SVG's `font-face`, `font-face-*`, `color-profile` and `missing-glyph` get their static attributes set at runtime through `customProp` instead of in the template. For `<math><annotation-xml encoding="text/html"><p>h</p></annotation-xml></math>` the template carries no `encoding`, so the HTML parser does not treat the element as an HTML integration point and breaks out of `math` at `<p>`, dropping the structure the compiler navigates. These names are reserved by the custom-elements spec and are never custom elements; seen while proving `fragments: 'tree'` (the tree form builds the authored structure, the HTML form the broken one).