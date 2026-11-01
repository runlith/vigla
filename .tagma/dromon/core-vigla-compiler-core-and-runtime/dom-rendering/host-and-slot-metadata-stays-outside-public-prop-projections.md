---
id: 01a19470-37e4-7d62-b5ec-51a71ad965a9
title: Host and slot metadata stays outside public prop projections
ord: 21
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/dom/custom-element.ts
  - kind: file
    ref: packages/vigla/src/shared/slots.ts
  - kind: symbol
    ref: packages/vigla/src/compiler/client/component.ts
    symbol: propsObject
  - kind: symbol
    ref: packages/vigla/src/compiler/server/component.ts
    symbol: propsObject
---
A custom element's host and available slots belong to that invocation, not to the values a component forwards. Weak metadata on the private props envelope avoids enumerable internal keys; public whole-props and rest projections have their own identity. Component calls attach their own snippet-slot names on both targets, so forwarding a parent's props cannot confer its host or replace a child's slot availability.