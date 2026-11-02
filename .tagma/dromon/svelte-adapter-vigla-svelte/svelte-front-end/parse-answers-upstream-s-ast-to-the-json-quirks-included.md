---
id: 01a1876b-5b15-7ab0-b9a5-e4a1033b7f81
title: "`parse()` answers upstream's AST to the JSON, quirks included"
ord: 1
tags: ["explanation"]
sources:
  - kind: dir
    ref: packages/svelte/src/front/parse
  - kind: file
    ref: packages/svelte/src/front/ast.ts
  - kind: file
    ref: packages/svelte/src/front/legacy.ts
---
Upstream `svelte-check` builds its TSX through svelte2tsx from `parse()`, and prettier-plugin-svelte reads it too, so the AST is compared with upstream's as JSON: same keys present or absent, same values, same `start`/`end`/`loc`, and the ESTree acorn 8 with acorn-typescript 1.0 produces under upstream's options (`ecmaVersion: 16`, `locations`, `preserveParens` for template expressions, then parentheses removed). A key upstream leaves absent stays absent — `instance` and `module` without a script, `fallback`, `index` and `key` on an each block without them — and nothing internal (analysis metadata, the TypeScript flag) is on a node.

Behaviour that looks accidental is kept because tools depend on the shape it produces: every JS comment met so far, template ones included, is offered to the script's comment attachment; the legacy converter leaves a `ComplexSelector` nested inside a pseudo-class argument unconverted; an unclosed ancestor in `loose` mode keeps `end: -1`; `{#each}` backtracks over `as` by re-parsing a shortened template.

The parser walks the template once: no scan restarts from the beginning, and lookups such as character references and line positions are bounded per character, since parsing is part of the compile-time target.
