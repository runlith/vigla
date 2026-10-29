---
id: 01a187bd-5530-7f95-be26-80d25664f76a
title: Carry template expressions' source positions into generated code so the JS map covers the template
ord: 3
tags: ["task"]
fields:
  {
    "holder": "tagma:01a187a1-6608-7ee2-9f47-f0c567ddde77",
    "status": "in_work"
  }
edges:
  - kind: discovered-from
    to: 01a187b5-42f7-7bb6-a2cc-2cedd9d78ae9
---
Generated template code maps nothing back to the component. For example, `{name}` becomes `$$props.name` with no source position, so the JS map has no segment into the template, and a script-only map drops `input.svelte` from `sources`. svelte/sourcemaps `sourcemap-sources` and `each-block` fail on targets/vigla for this reason. Upstream keeps each source identifier's location on the expression it rewrites.