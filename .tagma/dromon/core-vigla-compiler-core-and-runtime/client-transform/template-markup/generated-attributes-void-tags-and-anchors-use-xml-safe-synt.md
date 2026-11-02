---
id: 01a193d5-45df-7fa9-bcb3-666ffdf2c054
title: Generated attributes, void tags and anchors use XML-safe syntax
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/compiler/client/element.ts
  - kind: file
    ref: packages/vigla/src/compiler/server/template.ts
  - kind: symbol
    ref: packages/vigla/src/compiler/client/template.ts
    symbol: anchorPart
---
A template may be parsed in an XHTML document, where a bare boolean attribute, an unclosed void element or a short bogus comment is a syntax error. Static client templates and static server markup therefore give empty attributes quoted values, self-close void tags, normalize ordinary HTML names and use standard empty comment anchors; these forms preserve their HTML meaning without a repair step at the runtime parser.