---
id: 01a19e79-5908-7a61-9ac7-1c0676e03bc4
title: "Check #6914 and #4712 on the affected Safari engines"
ord: 6
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: discovered-from
    to: 01a19574-64a8-7ee5-8a9b-8d5d4fab4d64
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
---
The two frozen reports routed to the DOM runtime that need old WebKit: #6914 and #4712 reproduce on iOS 15 / Safari 15 and 17, which this machine cannot run (no such engine, and Playwright WebKit lacks its executable). A pass on modern Safari does not settle them. Prove each with a public regression on the affected engine, or exclude it in [[2e546434]] with retained evidence, once such an engine is available.