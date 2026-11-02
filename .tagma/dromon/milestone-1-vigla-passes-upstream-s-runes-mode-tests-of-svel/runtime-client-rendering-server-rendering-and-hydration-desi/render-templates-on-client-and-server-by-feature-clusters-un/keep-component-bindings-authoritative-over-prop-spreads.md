---
id: 01a19c20-e030-7adc-918c-afe4f1723ee6
title: Keep component bindings authoritative over prop spreads
ord: 2
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19c21-860c-7039-adc1-0eb2aca9a83f",
    "status": "in_work"
  }
---
Client and server component-prop lowering now defers ordinary binding accessors past surrounding spreads while preserving getter/setter pairs and client mutability/forwarding envelopes; function bindings retain upstream's source ordering. The routed bind-and-spread-precedence sample moved from four failures (`bar` versus `foo`) to passes in dom, hydrate, ssr and async-ssr. Those four exact sorted IDs were added manually to targets/vigla/passing/svelte/runtime-runes.txt. The scoped author run passed all 12 reported modes across bind-and-spread-precedence, bind-and-spread, spread-props and spread-props-2; seven recorded modes across non-local-mutation-with-binding, non-local-mutation-with-binding-7 and bind-getter-setter also passed, as did all four recorded own/runtime/store-forwarded-binding modes. `tsrs -p packages/vigla --noEmit` reported only unrelated TS2554 event-helper arity errors in client/element.ts (234,8 and 486,51), events.ts (96,34) and special.ts (145,27); no whole suite or application was run.