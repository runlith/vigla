---
id: 01a19451-070f-757a-85cf-3dc1dfed5cd3
title: Executable deployments embed the same closed asset set the directory build serves
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/adapter-bun/src/build.ts
  - kind: file
    ref: packages/adapter-bun/src/static.ts
---
Assets are collected before executable compilation, including files read by server code, so the executable has no dependency on the original client directory. Static routes use build-derived validators because file-backed Bun responses do not supply the in-memory route validator contract; range requests select the identity representation and leave byte delivery to Bun.