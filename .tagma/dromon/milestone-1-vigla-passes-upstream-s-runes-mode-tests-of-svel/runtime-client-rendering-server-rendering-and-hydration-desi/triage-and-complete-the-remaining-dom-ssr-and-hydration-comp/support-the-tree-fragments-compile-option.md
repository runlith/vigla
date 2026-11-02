---
id: 01a19e32-1cfa-773c-84ce-4a35a0d446ca
title: Support the tree fragments compile option
ord: 8
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e32-fa86-7726-ad34-3da4fcf89cb6",
    "status": "in_work"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fad9ca8ebb2
---
`functional-templating` in dom, hydrate, ssr and async-ssr fails because the adapter rejects `fragments: 'tree'` as unsupported. Implement the option's upstream behaviour — templates built by DOM calls instead of an HTML string — through the template IR and client output, and record the four variants.