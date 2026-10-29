---
id: 01a1865b-f27b-7722-bc99-e58b1f9853a5
title: "Lay out the core and the adapter: module map, front-end port, template IR, scheduler model, and one component through targets/dromon"
ord: 10
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1865c-5460-7380-a4fb-77718790e359",
    "status": "done"
  }
edges:
  - kind: relates
    to: 01a1868a-e2b0-7beb-b51f-7ccf553dc3c5
  - kind: relates
    to: 01a1868a-e2b1-75a8-92fb-02edaa9fb09b
---
Before the core grows, its shape: `packages/dromon` and `packages/svelte` with their `#module` cards and relations as [[07b61535]] draws them; the front-end port (source → IR, script ESTree, diagnostics); the template IR's node types as [[9ca8ebb2]] names them; the scheduler's data model written against the invariants of [[9d5e3831]]. Each lasting choice is an `#explanation` under the module owning it. Proven end to end by `targets/dromon` (`svelte` aliased to `@dromon/svelte`, `dromon` beside it) compiling and mounting one runes component with state, a derived, an `{#if}` and an `{#each}` through the harness's runner, client and server, and by the gate check of [[b3360999]] holding.