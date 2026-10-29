---
id: 01a18752-ff03-7988-bdb3-d50f7b2f1bd2
title: Parse .svelte as upstream does and pass the parser, print, preprocess, validator and compiler-errors suites
ord: 3
tags: ["task"]
fields:
  {
    "holder": "tagma:01a18754-3aa0-76c8-9776-449a21a808bb",
    "status": "in_work"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fad9ca8ebb2
---
The front end parses a subset today. Rewrite it to parse everything upstream's parser does — legacy and modern AST, `loose`, syntax-bound diagnostics — lowering all of it to the IR, and build `parse`, `parseCss`, `print`, `preprocess`, `VERSION` and validation with upstream's codes and messages in `svelte/compiler`. Then CSS scoping and the css suite.