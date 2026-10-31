---
id: 01a193fe-d217-7081-a893-800bbb0b1481
title: Component extensions arrive from the Vite plugin's discovered front ends
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/config/index.ts
  - kind: file
    ref: packages/kit/src/config/schema.ts
---
Configuration validates explicit component extensions but defaults to none. The Vite plugin supplies the extensions of the front ends it found before project sync discovers components; choosing an extension in configuration itself would couple Kit to one front end.