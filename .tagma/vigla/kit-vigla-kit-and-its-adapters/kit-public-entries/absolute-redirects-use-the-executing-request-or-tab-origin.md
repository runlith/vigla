---
id: 01a19584-dc61-7de2-b11b-8604406aa261
title: Absolute redirects use the executing request or tab origin
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/client/origin.ts
  - kind: file
    ref: packages/kit/src/entries/index.ts
  - kind: file
    ref: packages/kit/src/server/origin.ts
---
An absolute destination on the current origin is internal even when the server hook resumes after an await. The public redirect operation obtains that origin through a conditional package import, keeping request lookup out of browser bundles. Server validation uses the captured Request URL rather than the derived event URL, so query guards still hide route-dependent state without blocking redirects. Outside a request, an unknown server origin retains the external-redirect permission check.