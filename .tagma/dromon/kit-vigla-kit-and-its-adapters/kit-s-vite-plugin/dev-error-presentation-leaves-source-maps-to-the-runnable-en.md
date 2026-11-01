---
id: 01a1955e-5018-7100-8f0a-536816589c74
title: Dev error presentation leaves source maps to the runnable environment
ord: 8
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/vite/dev.ts
---
The legacy SSR stack fixer interprets frames already handled by the runnable environment as generated positions, and can append its warning to the application's error message. Kit sanitizes null bytes before HTTP output without applying that second mapping, so error hooks receive the original message.