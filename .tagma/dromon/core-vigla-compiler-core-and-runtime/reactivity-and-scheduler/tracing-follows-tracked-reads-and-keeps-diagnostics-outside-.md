---
id: 01a193c4-e7ae-7f38-8d9f-ed92226fbb20
title: Tracing follows tracked reads and keeps diagnostics outside source lifetimes
ord: 7
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a187ef-87f1-7eba-ae15-b2dd82502fc0
sources:
  - kind: file
    ref: packages/vigla/src/runtime/reactivity/trace.ts
---
A trace observes the reaction currently tracking its body: nested traces collect separately, derived inputs are shown beneath their derived, and untracked reads add nothing. Values and write provenance follow the reaction's batch view; a fork publishes its provenance only when applied. Highlighting uses a separate watermark so a reaction's own write remains visible on the rerun it caused. DEV labels follow a proxy's latest path, including replacements and cyclic references. Labels and provenance are weakly keyed, so diagnostics cannot keep a destroyed tree alive. Write stacks are enabled only by a module using tracing; production writes and reads do not collect them.