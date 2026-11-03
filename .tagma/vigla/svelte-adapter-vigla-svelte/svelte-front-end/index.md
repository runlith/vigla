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
Fills the core's port for `.svelte`. It parses component source into upstream's AST: the modern format, and the legacy format `parse()` answers by default, with `loose` recovery and TypeScript through `@sveltejs/acorn-typescript`. It lowers every construct to the template IR with TypeScript stripped, resolves global runes in `.svelte` and `.svelte.js`, and records `svelte-ignore` scopes for the core. With upstream's codes and messages it reports the errors and warnings whose subject exists only in `.svelte` syntax: parse errors, block and tag openings, `{@const}` placement, component directives, quoted attributes, `$:`, and `<svelte:*>` and `<title>` rules. Legacy syntax is a compile error, keeping upstream's code and message where upstream has one; this includes constructs upstream only warns about in runes mode, such as `on:`, `<slot>` outside a custom element, `<svelte:component>`, `context="module"`, `accessors` and `immutable`. Checks whose subject the IR carries belong to the core's analysis, and what the core cannot compile yet it refuses as `unsupported`.