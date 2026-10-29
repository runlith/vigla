---
id: 01a187de-cb69-744e-a4c9-fbd6914a1860
title: Run each server render() under a request owner and bind server context to owners
ord: 4
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: discovered-from
    to: 01a18776-8ec9-7c19-8ef7-f27ebfb6a8b0
  - kind: implements
    to: 01a18776-8e37-7bdc-93a5-7dae8191e72f
---
On the server, context lives in the render call's own layer stack (`runtime/server/context.ts`), not on owners: `render()` runs under no root, `getOwner()` inside a server component answers `null`, and `owner.run(() => setContext(...))` outside a render throws `context_without_owner`. The spec's server primitive is an owner per `render()` call that context and roots hang from, as on the client; `svelte`'s init-only projection stays as it is.