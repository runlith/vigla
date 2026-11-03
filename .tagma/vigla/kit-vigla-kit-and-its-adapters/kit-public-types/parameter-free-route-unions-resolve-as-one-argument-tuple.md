---
id: 01a1a16c-f3bb-74d5-bab1-05ef0854b318
title: Parameter-free route unions resolve as one argument tuple
ord: 7
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/types/paths.ts
---
Distributing a large parameter-free route union into separate one-element argument tuples makes the checker reject a variable carrying that union. Resolve keeps these ids together in one tuple; unions containing parameterized routes still use the correlated branches so a route cannot be paired with another route's parameters.