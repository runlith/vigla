---
id: 01a18612-c762-7ce4-a9aa-f973117980d1
title: A runner imports nothing under `svelte/internal` or a target's own sources
ord: 1
tags: ["rule"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fab49056597
sources:
  - kind: dir
    ref: harness
---
Only a target's fresh-state hook in `targets/<name>` touches that target's internals. Samples are data and keep the imports upstream gave them.