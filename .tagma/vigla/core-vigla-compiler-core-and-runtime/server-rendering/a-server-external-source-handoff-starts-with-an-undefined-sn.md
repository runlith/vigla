---
id: 01a19402-3855-73b9-8daf-be2ea2e85efc
title: A server external-source handoff starts with an undefined snapshot
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/server/external.ts
---
A replacement source may not emit synchronously. Server rendering must then read an empty snapshot rather than attribute the previous source's value to it; client subscriptions retain that prior value until the replacement emits. Owner disposal and render completion both release server subscriptions, including when a native application root creates one outside a render.