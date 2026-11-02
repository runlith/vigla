---
id: 01a19cf7-f95f-7896-90f2-198b8c01430f
title: Protect implicit children snippets against string coercion
ord: 9
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: discovered-from
    to: 01a193f2-ff55-75b7-98e3-3cbacd2aed6d
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
---
Complete snippet-children-without-render-tag-dev in dom and hydrate. The fresh public reports expect snippet_without_render_tag but observe no runtime error; implicit children lowering emits an unprotected arrow while explicit snippets use the existing shared protection. Confirm the full producer path and reuse that contract without weakening valid snippet rendering or production behavior. Land the two passing ids manually with the source after the exact cases and affected snippet controls pass.