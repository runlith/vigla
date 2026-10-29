---
id: 01a1863e-cc92-7293-a8fd-101ec7aced57
title: "Probe the core's JS/TS parser: oxc-parser against acorn with @sveltejs/acorn-typescript"
ord: 1
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1863e-fcee-717c-9170-acf2f12eb87c",
    "status": "done"
  }
---
Measure both against every requirement the parser paragraph of [[9ca8ebb2]] names, on upstream's `compiler` benchmark inputs and the parser samples, and record the results and the choice in a research block under the spec; the probe code stays outside the repository.