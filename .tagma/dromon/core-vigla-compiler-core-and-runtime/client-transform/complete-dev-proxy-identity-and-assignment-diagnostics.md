---
id: 01a19d99-c39f-7751-b52c-95887e7d79ad
title: Complete DEV proxy identity and assignment diagnostics
ord: 25
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19d85-4ece-781a-ad63-aacdbcf24324",
    "status": "done"
  }
edges:
  - kind: discovered-from
    to: 01a193f2-ff55-75b7-98e3-3cbacd2aed6d
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fad9ca8ebb2
---
Reproduce the four remaining proxy-coercive-assignment-warning and state-proxy-equality-mismatch DOM/hydrate variants and locate their first missing diagnostic producer. Preserve the already-correct runtime values and production behavior; Svelte DEV warning policy belongs in its compiler/adapter projection, not Core proxy policy. Prove the exact frozen warning conditions with bounded public controls and record the four original variants with source once independently reviewed.