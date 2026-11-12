---
id: 01a1958b-14ab-7e05-927d-19664cf0ae85
title: Compiled listeners retire with their rendering owner
ord: 30
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/compiler/client/events.ts
    symbol: event
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/attributes.ts
    symbol: attributes
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/events.ts
    symbol: delegated
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/events.ts
    symbol: event
  - kind: symbol
    ref: packages/vigla/src/runtime/reactivity/effects.ts
    symbol: atEnd
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/events.ts
    symbol: delegation
---
A retained detached node would otherwise keep its handlers' captured application state alive and, if reinserted under a live delegation root, dispatch a handler from the destroyed tree. A spread's listeners belong to the element owner rather than its repeating attribute effect; a delegated registration is removed only while it is still the element's registration for that event, so an older owner cannot erase a replacement, even when the same handler is assigned again.

Registrations an owner makes one after another form one chain, retired by one cleanup registered with `atEnd`. Under a branch or root, whose function never reruns, that cleanup joins the owner's own teardown, so a list row's handlers cost no effect and no closure per handler; an effect per row added a record per row, and a disposer closure per handler two more objects. Under an owner that reruns, the chain rides a teardown effect, which a rerun destroys, and the next registration starts a new chain. Retiring with the owner's own teardown runs after its children's teardowns, so every handler stays attached while any teardown of that owner runs, as upstream, which never removes them.