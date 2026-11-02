---
id: 01a19e4c-6062-7b6e-b383-36b52ad51ae8
title: Fix Kit client, preview and timing failures from the full measurement
ord: 5
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: discovered-from
    to: 01a19e32-1cfa-773c-84ce-4a3383b96456
  - kind: implements
    to: 01a193ed-396f-73b6-bbe3-bad77aa7b0be
---
From the full Kit measurement: preview redirect loops on a base path (`ERR_TOO_MANY_REDIRECTS`, ENOENT in `vite/preview.ts`); the service worker failing with `Cannot use 'import.meta' outside a module`; hash-based routing in dev and no-ssr error pages; scroll restoration after back; the remaining singletons; and the 25 timeouts whose producer is not yet known. Determine each producer, fix it there, and record the entries it makes pass.