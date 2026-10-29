---
id: 01a18680-7db9-7c10-b0ec-c0d1e0e72677
title: Shared core
ord: 1
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "escape.ts"
      },
      {
        "at": "markers.ts"
      },
      {
        "at": "html.ts"
      },
      {
        "at": "attributes.ts"
      },
      {
        "at": "diagnostics.ts"
      },
      {
        "at": "hash.ts"
      },
      {
        "at": "context.ts"
      }
    ],
    "id": "shared",
    "kind": "substrate"
  }
sources:
  - kind: dir
    ref: packages/vigla/src/shared
---
The bottom of the core, below both the compiler and the runtime: what both sides must agree on byte for byte — HTML escaping, the hydration markers server output writes and hydration reads, HTML knowledge such as void and boolean attributes, and how class and style values compose — plus the port runtime diagnostics leave through and the keyed context `createContext` hands out on client and server. It loads no package but `clsx` and holds no state but the installed reporter, so the runtime imports it without carrying compiler code.