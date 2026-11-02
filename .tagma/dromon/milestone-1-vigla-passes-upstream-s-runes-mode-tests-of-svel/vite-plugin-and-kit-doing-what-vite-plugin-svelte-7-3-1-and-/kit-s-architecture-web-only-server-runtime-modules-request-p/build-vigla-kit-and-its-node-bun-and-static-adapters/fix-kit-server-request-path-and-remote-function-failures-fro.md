---
id: 01a19e4c-6062-7b6e-b383-36b470d812e2
title: Fix Kit server request, path and remote-function failures from the full measurement
ord: 4
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e4c-df17-7ffe-82c3-6eb403812bda",
    "status": "in_work"
  }
edges:
  - kind: discovered-from
    to: 01a19e32-1cfa-773c-84ce-4a3383b96456
  - kind: implements
    to: 01a193ed-396f-73b6-bbe3-bad77aa7b0be
---
From the full Kit measurement: 64 basics `server.spec.js` 500s from `restrictSearch` (`server/url.ts:13`, reading `enumerable` of undefined); `Cannot run code under a disposed owner` from `RequestScope.run` in a stream pull, aborting prerendering/basics; path rendering for `paths.relative`, `paths.assets`, `inlineStyleThreshold` and the options-2 base path; async remote functions reading prerendered data in SSR and redirecting outside the app; and the `require-trusted-types-for` page error. Fix each at its producer and record the entries it makes pass.