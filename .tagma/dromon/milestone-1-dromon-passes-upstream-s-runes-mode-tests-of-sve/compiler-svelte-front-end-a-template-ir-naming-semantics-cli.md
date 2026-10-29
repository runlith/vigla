---
id: 01a185b6-09f2-796e-90b2-9fad9ca8ebb2
title: "Compiler: .svelte front end, a template IR naming semantics, client and server output"
ord: 4
tags: ["spec"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: relates
    to: 01a1852f-ba89-7089-9ac3-30ea8cd5da81
---
**Pipeline.** `.svelte` source → upstream-shaped AST → template IR plus script ESTree → analysis → client output and server output; CSS is scoped from the style AST.

**`parse()` keeps upstream's AST.** The legacy format by default and the modern one with `modern: true`, as the parser suites pin: svelte2tsx reads the legacy format, so upstream tooling keeps working on `.svelte`. Legacy-mode constructs are rejected at compile with upstream's codes; the AST is what tooling needs to show that diagnostic.

**The IR names semantics, not syntax** — branch, keyed list, keyed block, async block, boundary, snippet and render, element, component, text, expression, attributes and directives — so the TSX front end of [[8cd5da81]] lowers to the same nodes later. Analysis and code generation read only the IR and the script ESTree, never the `.svelte` AST.

**Public compiler API** is upstream's minus `migrate`: `compile`, `compileModule` for `.svelte.js` and `.svelte.ts` modules, `parse`, `print`, `preprocess`, `VERSION`, with upstream's error and warning codes and messages.

**Parser and printer.** The first task is a probe deciding the JS/TS parser between `oxc-parser` (native, with a WebAssembly build for browsers, TS and TSX built in) and upstream's acorn with `@sveltejs/acorn-typescript`: the ESTree shape, UTF-16 offsets for error positions and sourcemaps, running in a browser, and parse time on upstream's `compiler` benchmark inputs. Output is printed from ESTree with sourcemaps by `esrap` unless the probe gives a reason against it.

**Acceptance.**
- The validator, compiler-errors, parser-legacy, parser-modern, print, preprocess, sourcemaps and css contracts pass.
- Every IR node type is stated with its `.svelte` form and its TSX form in an `#explanation` under the IR module.
- Upstream's `compiler` benchmark meets the milestone's benchmark criterion.
