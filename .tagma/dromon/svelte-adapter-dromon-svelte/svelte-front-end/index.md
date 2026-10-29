---
id: 01a18680-7dc3-7684-af68-bcd6e92717c9
title: "`.svelte` front end"
ord: 1
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "index.ts"
      }
    ],
    "id": "svelte-front-end",
    "kind": "product"
  }
edges:
  - kind: imports
    to: 01a18680-7dc2-71f8-be01-915833d45c4b
sources:
  - kind: dir
    ref: packages/svelte/src/front
---
Fills the core's port for `.svelte`: parses component source into upstream's AST — the modern format, and the legacy format `parse()` answers by default — with `loose` recovery and TypeScript through `@sveltejs/acorn-typescript`, lowers every construct to the template IR with TypeScript stripped, resolves global runes in `.svelte` and `.svelte.js`, records `svelte-ignore` scopes for the core, and reports with upstream's codes and messages the errors and warnings whose subject exists only in `.svelte` syntax — parse errors, block and tag openings, `{@const}` placement, component directives, quoted attributes, `<svelte:*>` and `<title>` rules. Checks whose subject the IR carries are the core analysis's; what the core cannot compile yet the core refuses as `unsupported`, and the front end refuses only the legacy constructs no IR node carries.