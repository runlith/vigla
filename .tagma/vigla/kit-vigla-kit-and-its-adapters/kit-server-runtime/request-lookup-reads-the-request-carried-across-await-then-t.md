---
id: 01a193ff-f879-7e28-88cb-81227bef7fb4
title: Request lookup reads the request carried across `await`, then the owner's context
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/server/scope.ts
---
Every `runRequest` puts its request store in one core `AsyncVariable` and runs the callback under that request's owner. A derived store — a traced, data or remote event — is therefore what a continuation after `await` finds, while the code itself still runs under the request owner. `getOwner()` stays the request owner, and context written in a hook lands on it.

Lookup reads the carried store first and the ambient owner's context second; each counts only while the request is active. A rendered component finds its store through the render's context map. Reading the owner first once let a render's resumed owner from another request answer.

Without a platform store the variable is synchronous-only, so a lookup after `await` fails with `request_event_after_await`. A realm admits one store, so the dev server, preview, the build runtime and the adapters create it once per process and hand it to every `init`. A store becomes unavailable when its response body ends, is cancelled or its request aborts, which keeps delayed callbacks from reusing a disposed request.
