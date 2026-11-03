---
id: 01a19eb6-7ec0-7027-bcf3-d10cd0d6b419
title: $app/manifest immutable lists the client manifest's files in entry order
ord: 14
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/kit/src/vite/build.ts
    symbol: immutableFiles
---
Service workers precache `immutable` and treat its first item as the application's entry bundle, so the list follows the Vite client manifest: each chunk's file, then its CSS, then its assets, entries first. Walking `_app/immutable` on disk sorted `assets/` ahead of the bundle and also picked up files no client chunk references, such as assets copied in from the server build. Inlined bundle and stylesheet files are left out because they are deleted after being inlined into the page.