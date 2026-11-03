---
id: 01a1946d-d07a-72bb-be87-c2da9ddeafef
title: Remote wrappers carry identity while each request owns its values
ord: 7
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/server/remote/query.ts
  - kind: file
    ref: packages/kit/src/server/remote/resource.ts
  - kind: file
    ref: packages/kit/src/server/scope.ts
---
Module exports retain metadata, not user data. Query values, batching, keyed form instances and live consumers belong to the RequestStore, preventing a loaded remote module from retaining another request's result. Resources capture that whole store at creation so refresh, set and iteration retain the same request even without an async-context platform port.