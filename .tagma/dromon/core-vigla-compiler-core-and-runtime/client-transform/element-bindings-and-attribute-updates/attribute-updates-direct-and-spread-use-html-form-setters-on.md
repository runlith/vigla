---
id: 01a19546-64ab-7f87-a066-891bd3f05dbb
title: Attribute updates, direct and spread, use HTML form setters only in the HTML namespace
ord: 4
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/compiler/client/element.ts
    symbol: update
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/attributes.ts
    symbol: attributes
---
A foreign element can share a form tag or attribute name without sharing its DOM property semantics. Generic attribute updates preserve its string values instead of applying HTML-specific boolean or value handling; a spread on a foreign element likewise writes `value` and `checked` as attributes, never as the `__value`/`value` expandos or the input-default reset the HTML path uses, so client output keeps the attribute the server renders. Upstream 5.57.3 sets the expandos on any non-custom element's spread; an SVG or MathML element then loses its `value` attribute (own sample `reserved-custom-names`).