---
id: 01a19444-6b3a-75b9-839a-2732f8c95c66
title: Bun deployment adapter
ord: 14
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "src/index.ts"
      }
    ],
    "id": "adapter-bun"
  }
edges:
  - kind: imports
    to: 01a193f1-4d97-7589-b3a8-69aa6c365dd0
sources:
  - kind: dir
    ref: packages/adapter-bun
---
A deployable Bun server for Kit applications, as a directory or a single executable. It owns output assembly, embedded assets, Bun-native static delivery and process shutdown; application routing and rendering remain the built server's.