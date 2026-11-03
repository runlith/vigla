---
id: 01a1861f-7afa-7562-a9d9-92d2ff439d88
title: Run the runtime-side Svelte suites through the harness on targets/upstream
ord: 2
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1861f-b38e-725d-8300-9ca3c6617dfc",
    "status": "done"
  }
---
hydration, server-side-rendering, runtime-browser with its custom-element samples and `test-ssr.ts`, runtime-production, runtime-xhtml and motion, with manifest entries and statuses as [[658ccea4]] orders them. Done when, for each suite, the harness passes exactly the contract entries upstream's own runner passes with runes forced and async on, checked by `harness/src/compare.ts`, and one command runs every suite the harness has.