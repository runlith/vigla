---
id: 01a193c4-711d-777f-86c2-681ad4bdeffe
title: Compiled static HTML stays in template literals for downstream transforms
ord: 7
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/compiler/client/template.ts
    symbol: render
---
A Vite transform can run after compilation and amend the HTML embedded in the generated module, including inserting literal newlines. Keeping that HTML in a template literal makes such transforms valid JavaScript; quoted string literals would require the transform to escape its inserted text.