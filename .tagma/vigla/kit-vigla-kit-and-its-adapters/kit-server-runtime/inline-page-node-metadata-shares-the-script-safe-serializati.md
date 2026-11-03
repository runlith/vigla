---
id: 01a19cc4-cc7c-79b6-b00b-92a27060fd45
title: Inline page-node metadata shares the script-safe serialization boundary
ord: 19
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/server/data.ts
---
Tracked search names and other page-node metadata can contain script-closing text even when load data itself is safe. The HTML payload and transport decoder names therefore need script-safe encoding at their producer; the separate data-response wire retains its JSON and devalue representation.