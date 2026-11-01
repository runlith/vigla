---
id: 01a19546-64ab-7f87-a066-891bd3f05dbb
title: Direct attribute updates use HTML setters only in the HTML namespace
ord: 14
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/compiler/client/element.ts
    symbol: update
---
A foreign element can share a form tag or attribute name without sharing its DOM property semantics. Generic attribute updates preserve its string values instead of applying HTML-specific boolean or value handling.