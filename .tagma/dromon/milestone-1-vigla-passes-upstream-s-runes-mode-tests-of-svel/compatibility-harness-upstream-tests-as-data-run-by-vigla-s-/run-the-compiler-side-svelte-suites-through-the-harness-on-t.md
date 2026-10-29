---
id: 01a1861f-7afd-72f3-b9a7-8c1c7204f421
title: Run the compiler-side Svelte suites through the harness on targets/upstream
ord: 3
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1861f-b38e-725d-8300-9ca3c6617dfc",
    "status": "done"
  }
---
validator, compiler-errors, parser-legacy, parser-modern, print, preprocess, sourcemaps, css and `css-parse.test.ts`, with manifest entries and statuses as [[658ccea4]] orders them, the parser suites run as they are. Done when, for each suite, the harness passes exactly the contract entries upstream's own runner passes, checked by `harness/src/compare.ts`.