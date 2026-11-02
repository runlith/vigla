---
id: 01a1944b-68f4-7179-a568-3053b1986315
title: Preprocessor dependency keys normalize Windows separators
ord: 2
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vite-plugin/src/plugins/preprocess.ts
    symbol: Dependencies
  - kind: symbol
    ref: packages/vite-plugin/src/plugins/preprocess.ts
    symbol: dependencyKey
---
PostCSS can report Vite-normalized Windows dependency paths while Sass and watcher events use native separators. Cache writes, lookups and removals use one identity for those forms, while filesystem watching keeps the original path spelling; reusing the key for filesystem access could reinterpret UNC paths. Canonicalization is limited to drive and UNC forms so a POSIX filename's backslashes stay literal.