---
id: 01a19e32-1cfa-773c-84ce-4a36d5212cbb
title: Complete async reactivity-loss and remaining runtime diagnostics
ord: 9
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e32-faf9-79d3-a45e-e80726ffa2bb",
    "status": "in_work"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
---
Twelve dom/hydrate variants of `async-reactivity-loss`, `-async-after-sync`, `-for-await`, `-for-await-break-return`, `-for-await-throws-1` and `-2` render the right values but miss upstream's reactivity-loss warning. Also: `bind-getter-setter-loop` dom/hydrate (HTML mismatch), `derived-fn-recursive (dom)` (stack overflow instead of `derived_references_self`), and `invalid-html-ssr` / `invalid-html-ssr-ancestor` hydrate (missing `node_invalid_placement_ssr` errors). Fix each at its producer — Svelte DEV policy in the adapter, general mechanisms in the core — and record the variants.