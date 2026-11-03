---
id: 01a1a170-93b5-72c7-a885-0f280cc265ee
title: A data response returns only the nodes the browser invalidated, even when a child's await parent() re-ran a reused ancestor
ord: 23
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/kit/src/server/data.ts
    symbol: dataResponse
---
A child's `await parent()` can execute an ancestor the browser marked reusable, and the child then sees that fresh result. The response still skips the ancestor, so the page keeps the ancestor data it already had. Upstream pins this in basics' "+layout.server.js re-runs when await parent() is called from downstream load function" as intended behaviour: a load with side effects in a GET is the app's bug. Returning the fresh ancestor (an earlier attempt at Kit #9355) broke that contract test. Executions are still discovered before the response is built, so an independent `redirect` ends the response without waiting for other loads.