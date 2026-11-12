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
---
A retained detached node would otherwise keep its handlers' captured application state alive and, if reinserted under a live delegation root, dispatch a handler from the destroyed tree. A spread's listeners belong to the element owner rather than its repeating attribute effect; a delegated registration's disposer clears only that exact registration, so an older owner cannot erase a replacement, even when the same handler is assigned again. Delegated registrations an owner makes one after another share one teardown effect, appended while that effect is still the owner's last child: a row of a large list registers a handler per element, and an effect per handler doubled the effects such a row creates and destroys. Grouping only adjacent registrations keeps every disposal in the place among the owner's children that a teardown per handler would have had.