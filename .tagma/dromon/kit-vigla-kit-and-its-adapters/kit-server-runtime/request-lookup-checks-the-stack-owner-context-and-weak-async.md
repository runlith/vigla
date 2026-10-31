---
id: 01a193ff-f879-7e28-88cb-81227bef7fb4
title: Request lookup checks the stack, owner context and weak async ports
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/server/scope.ts
---
Synchronous calls and rendered components find their request directly; continuations after an await need the platform's async-context port. Several `Server` instances may use different ports, so lookup checks each live port instead of keeping the last initialized one. The registry retains ports weakly and retains no request store; a store becomes unavailable when its response body ends, is cancelled or its request aborts, preventing delayed callbacks from reusing a disposed request.