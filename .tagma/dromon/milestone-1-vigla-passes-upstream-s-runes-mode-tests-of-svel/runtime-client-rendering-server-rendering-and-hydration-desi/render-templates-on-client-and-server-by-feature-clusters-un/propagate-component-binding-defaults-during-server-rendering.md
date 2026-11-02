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
Complete component-binding and component-binding-renamed in synchronous and asynchronous SSR. The retained remainder reports render :foo: instead of 1:foo:1. Recheck those four variants on the current tree, read the upstream behavior and full server lowering/render path, fix the producing binding/writeback contract where still wrong, and land the four passing ids with the source. Reuse applicable evidence if the current producer already makes a case pass; do not add a client or Kit workaround.