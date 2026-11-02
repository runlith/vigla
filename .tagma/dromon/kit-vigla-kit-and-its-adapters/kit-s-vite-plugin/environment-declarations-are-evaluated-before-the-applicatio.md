---
id: 01a1941f-8ef5-7bac-831e-e91f82f6f909
title: Environment declarations are evaluated before the application graph exists
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/vite/env.ts
  - kind: file
    ref: packages/kit/src/vite/server.ts
  - kind: file
    ref: packages/kit/src/sync/env.ts
  - kind: file
    ref: packages/kit/src/vite/index.ts
---
Type synchronization needs names and schemas even when deployment values are unavailable, so Kit's Vite config resolution performs neither declaration evaluation nor value validation. Declarations load before application modules exist, in a short-lived runner that exposes environment flags and rejects other app imports to avoid cycles. Build validates its compile-time snapshot before consuming application modules. Development validates current values when an application request consumes the runtime; preview validates through generated server configuration before initializing hooks. User variable names remain export aliases over independent internal bindings to prevent collisions with generator names.