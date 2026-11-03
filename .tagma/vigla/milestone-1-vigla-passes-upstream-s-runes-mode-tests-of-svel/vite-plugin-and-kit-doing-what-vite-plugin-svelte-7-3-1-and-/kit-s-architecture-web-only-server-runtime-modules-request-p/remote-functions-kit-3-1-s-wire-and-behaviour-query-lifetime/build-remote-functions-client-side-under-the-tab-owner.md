---
id: 01a1945a-8ae5-7a0e-aa6a-14c1c9a010c2
title: Build remote functions' client side under the tab owner
ord: 2
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1945b-1c58-71fb-adba-35b832991389",
    "status": "done"
  }
edges:
  - kind: implements
    to: 01a1945a-6dcb-7f88-ba1f-c9b4d274a460
---
Owner `kit-client` (`client/remote/`): the client factories every generated stub calls, exported from `<kit>/internal/client`; the per-tab cache with owner-held entries; query, batch, live, command, form and prerender clients; hydration of server-resolved values through the core's `hydratable`.