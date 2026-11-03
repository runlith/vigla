---
id: 01a19cac-5d41-7e78-802f-3d8647579b2d
title: Public prerendered manifest paths are application-relative
ord: 13
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/kit/src/vite/build.ts
    symbol: buildPlugin
---
The public asset manifest uses one application-relative namespace so consumers can resolve its entries under their configured base. The crawler and runtime prerender index retain deployment pathnames for request matching; only publication into $app/manifest removes the base and leading separator.