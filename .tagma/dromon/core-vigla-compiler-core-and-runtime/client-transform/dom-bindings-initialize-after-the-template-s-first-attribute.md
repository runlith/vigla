---
id: 01a19578-157c-7869-8004-ed3a9058341d
title: DOM bindings initialize after the template's first attribute update
ord: 18
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/compiler/client/template.ts
    symbol: flush
  - kind: symbol
    ref: packages/vigla/src/compiler/client/bindings.ts
    symbol: binding
---
An absent bound value inherits the browser's default, so binding setup must observe attributes already applied. Setup runs once after the grouped content effect, rather than inside its repeating updates; bind:this stays earlier because it can affect directive setup.