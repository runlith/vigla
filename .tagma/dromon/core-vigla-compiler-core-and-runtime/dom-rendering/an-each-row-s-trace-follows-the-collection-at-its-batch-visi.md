---
id: 01a193cf-eeeb-7e94-9b4e-12a35c59f50a
title: An each row's trace follows the collection at its batch-visible index
ord: 11
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a193c4-e7ae-7f38-8d9f-ed92226fbb20
sources:
  - kind: file
    ref: packages/vigla/src/runtime/dom/list.ts
---
A keyed row survives reorders, so its diagnostic provenance must follow its current index in the tracing batch's view rather than the index at creation. The provenance read is untracked and suppresses the internal index signal, so tracing reports the application's collection without changing the row's reactive dependencies.