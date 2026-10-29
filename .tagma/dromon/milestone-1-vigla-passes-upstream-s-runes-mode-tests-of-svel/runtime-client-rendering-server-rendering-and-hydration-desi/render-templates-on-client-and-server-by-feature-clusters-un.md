---
id: 01a18752-ff03-7988-bdb3-d51034d8c1ab
title: Render templates on client and server by feature clusters until runtime-runes, hydration and SSR pass
ord: 1
tags: ["task"]
fields:
  {
    "holder": "tagma:01a184d8-1b37-7bfc-8899-05d6b3ce2282",
    "status": "in_work"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
---
Grow client and server code generation with the DOM and server runtimes one cluster of template features at a time — elements, attributes and events; branches and lists; components, props and bindings; snippets; special elements; transitions and animations; async blocks and boundaries once the scheduler's pending work exists — each passing its runtime-runes, hydration and server-side-rendering entries on `targets/vigla`; then runtime-browser, runtime-production, runtime-xhtml, motion and sourcemaps.