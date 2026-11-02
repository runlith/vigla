---
id: 01a19c81-5c79-729a-b7bc-608197ecddff
title: Restore recorded snippet and hydration cases after render diagnostics
ord: 6
tags: ["task"]
fields:
  {
    "holder": "tagma:01a187a1-6608-7ee2-9f47-f0c567ddde77",
    "status": "in_work"
  }
edges:
  - kind: discovered-from
    to: 01a18752-ff03-7988-bdb3-d51034d8c1ab
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
---
The post-integration recorded baseline fails seven existing entries with invalid_snippet: if-block-mismatch-2 (hydrate), and const-snippet-reactive, snippet-expressions and svelte-meta-parent (each dom/hydrate). Investigate the full compiler-to-runtime path, restore valid snippet rendering and hydration without weakening the intended invalid-call diagnostics, and prove the seven regressions plus relevant new diagnostic controls. Evidence: the lead scratch post-prior-view-2026-11-02/svelte.json. This is working-tree evidence with concurrent #10252 layout-protocol changes, not a clean per-commit baseline. Attribute the cause only after a scoped reproduction and call-chain reading. These are recorded regressions to fix, not progress entries to unrecord.