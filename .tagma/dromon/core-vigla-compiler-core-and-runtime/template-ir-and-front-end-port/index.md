---
id: 01a18680-7dbb-7e28-818d-c9e31564a15f
title: Template IR and front-end port
ord: 2
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "nodes.ts"
      },
      {
        "at": "port.ts",
        "role": "port"
      },
      {
        "at": "script.ts"
      },
      {
        "at": "estree.ts"
      },
      {
        "at": "style.ts"
      },
      {
        "at": "maps.ts"
      }
    ],
    "id": "ir",
    "kind": "kit"
  }
sources:
  - kind: dir
    ref: packages/vigla/src/compiler/ir
---
The core's input contract: the template IR every front end produces, whose node types name semantics rather than syntax so `.svelte` and TSX lower to the same nodes; the front-end port a front end fills — units, resolved runes, diagnostics, `CompileError`; the JS parser front ends read scripts and expressions with; and the ESTree tooling the compiler shares. It reads no source syntax of its own: that is each front end's work.