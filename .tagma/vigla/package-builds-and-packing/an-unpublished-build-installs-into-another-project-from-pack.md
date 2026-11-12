---
id: 01a1cd5d-f4a5-7da4-bb9f-30437284b4f2
title: An unpublished build installs into another project from `pack`'s tarballs, each named as a `file:` override
ord: 5
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a1adeb-5ce0-7482-acf2-16b99fc82ad4
sources:
  - kind: file
    ref: release/src/pack.ts
---
A fix found while running an application on Vigla is tried there before any release: `bun run pack --out <dir>` writes the nine tarballs in seconds, and the application depends on them as `file:<dir>/<tarball>`, the compatibility packages under their upstream names. Every tarball pins its siblings to exact versions, which the registry may not hold yet or holds with older content, so the application's root `overrides` must name every Vigla package by its own name with the same `file:` path; then each sibling resolves to its tarball and one copy of each is installed. Measured with bun 1.4.4 on the 0.1.1 tarballs: all nine resolved to the files. A commit of the application names only published versions — a `file:` path exists on one machine.