---
id: 01a1944e-9e69-7083-aa79-87960222e38c
title: Static strictness prevents deployment from silently losing dynamic routes
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/adapter-static/src/index.ts
---
Without a fallback, pathname-routed applications must have every route prerendered before output is written. Hash routing supplies its own single-page navigation boundary. Explicit options disable detected hosting defaults and completion so a deliberately selected output layout does not also receive a provider-specific deployment contract.