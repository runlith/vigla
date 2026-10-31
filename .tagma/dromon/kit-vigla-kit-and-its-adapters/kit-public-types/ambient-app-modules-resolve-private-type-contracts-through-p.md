---
id: 01a193fb-871a-772c-b339-09d0ea45352d
title: Ambient app modules resolve private type contracts through package imports
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/types/index.ts
  - kind: dir
    ref: packages/kit/types
---
The harness lists `types/index.d.ts` by its real path under NodeNext resolution. Its `$app/*` declarations import `#types/*`, resolved from Kit's own package scope into the same named TypeScript contracts used by the public export conditions; this preserves one identity under either installed package name without ambient declarations for the alias. Public type entries reference the ambient file so `App` augmentation and generated `$app/types` overloads also reach applications that import only a package subpath.