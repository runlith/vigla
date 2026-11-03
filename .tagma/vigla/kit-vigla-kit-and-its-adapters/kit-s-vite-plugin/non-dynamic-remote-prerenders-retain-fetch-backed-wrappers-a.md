---
id: 01a19559-0013-766e-9e7e-26e210159a2a
title: Non-dynamic remote prerenders retain fetch-backed wrappers after build
ord: 6
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/kit/src/vite/remote-build.ts
    symbol: pruneRemotes
---
A non-dynamic function must still read its static result during SSR; removing its export would break page loads and nested queries. After the crawl, the build substitutes the diagnostic fallback and tree-shakes the output module, retaining the existing factory binding so request scopes remain in the original built runtime. Resolving exports through their namespace entry prevents aliased or collision-renamed bindings from selecting another module's implementation.