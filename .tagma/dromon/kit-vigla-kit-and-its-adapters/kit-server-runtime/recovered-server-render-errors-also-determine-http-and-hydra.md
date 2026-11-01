---
id: 01a19558-f068-7ef1-8b1a-7f0c0807a9c1
title: Recovered server render errors also determine HTTP and hydration state
ord: 12
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/server/document.ts
---
A component error recovered by the core's server boundary does not reject the completed render. The transformed application error must still determine the document's HTTP status, rendered page state and hydration payload, or the browser would start a successful page over error markup and lose status overrides.