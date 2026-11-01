---
id: 01a19568-e263-767c-9db9-d78821bcc243
title: Redirects consume preloaded routing data and preserve the source entry
ord: 11
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/client/client.ts
  - kind: file
    ref: packages/kit/src/client/history.ts
---
A redirect chain is one navigation from the original page. Replacing history at intermediate hops would drop that page, while retaining a consumed preloaded redirect can replay it when a later hop returns after changing cookies. Only the terminal hop processes a failure: a fatal fallback ends the tab owner, so ancestor hops can no longer re-enter its error hook.