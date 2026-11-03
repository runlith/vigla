---
id: 01a19ca9-7a2c-7691-8044-49cb3785daf2
title: Split-build CSS and font preloads follow SSR source reachability
ord: 12
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/vite/dependencies.ts
  - kind: symbol
    ref: packages/kit/src/vite/build.ts
    symbol: buildPlugin
---
A stylesheet reachable from the client graph may belong to a component imported only after a browser interaction. Split builds associate CSS and fonts with their importing source and compare that identity against the component and universal module's SSR graph; chunk filenames differ between builds, and the client node entry substitutes for its original component. This preserves eager rendering resources without promoting browser-only dynamic imports into document preloads.