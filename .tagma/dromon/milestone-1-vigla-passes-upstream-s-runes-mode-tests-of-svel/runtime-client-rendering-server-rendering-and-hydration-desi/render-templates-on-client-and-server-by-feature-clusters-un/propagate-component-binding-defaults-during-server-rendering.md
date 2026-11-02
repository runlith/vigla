---
id: 01a19c79-2133-797c-a59b-e7a401361774
title: Propagate component binding defaults during server rendering
ord: 5
tags: ["task"]
fields:
  {
    "holder": "tagma:01a187a1-6608-7ee2-9f47-f0c567ddde77",
    "status": "in_work"
  }
edges:
  - kind: discovered-from
    to: 01a193f2-ff55-75b7-98e3-3cbacd2aed6d
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
---
Complete component-binding and component-binding-renamed in synchronous/asynchronous SSR: both now render 1:foo:1 instead of :foo:. Publish final bindable values through existing setters for undefined parent values and stabilize their template output. One review found root-snippet scope, lexical invalidation through children and premature publication across template awaits; all three were reproduced publicly and corrected. The final scoped assertions pass, including two upstream-green lexical cases and one measured async-settlement difference retaining body/head and overlapping-request isolation. Both package tsrs checks pass; four upstream rows and three own rows are hand-recorded with the source. Full suites are not rerun.