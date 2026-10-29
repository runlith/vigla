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
**Pipeline.** `.svelte` source → front end (upstream-shaped AST, syntax-bound diagnostics, `svelte-ignore` scopes) → template IR plus script ESTree → analysis → client output and server output; CSS is scoped from the style AST.

**`parse()` keeps upstream's AST.** The legacy format by default and the modern one with `modern: true`, as the parser suites pin; `loose: true` parses error-tolerantly, as svelte2tsx calls it and the `loose-*` samples pin. svelte2tsx reads the legacy format, so upstream tooling keeps working on `.svelte`.

**The front end owns what is bound to syntax**: diagnostics such as `attribute_quoted`, `element_implicitly_closed` and `bidirectional_control_characters`, and the scopes of `svelte-ignore` comments, which the IR carries as data. Analysis and code generation read only the IR and the script ESTree; their modules have no import relation to the front end.

**The IR names semantics, not syntax**: branch, keyed list, unkeyed list, keyed block, async block, boundary, snippet and render, element, component, text, expression, attributes and directives, `{@html}`, `{@const}`, `{@debug}`, `{@attach}`, `<title>`, the special elements (`svelte:head`, `svelte:window`, `svelte:document`, `svelte:body`, `svelte:element`, `svelte:options`) and a custom element's `<slot>` — so the TSX front end of [[8cd5da81]] lowers to the same nodes later.

**Public compiler API** is upstream's minus `migrate`: `compile`, `compileModule` for `.svelte.js` and `.svelte.ts` modules, `parse`, `parseCss`, `print`, `preprocess`, `VERSION`, with upstream's error and warning codes and messages.

**Compile options:**
- accepted as upstream's: `filename`, `rootDir`, `dev`, `generate`, `warningFilter`, `css`, `cssHash`, `cssOutputFilename`, `customElement`, `discloseVersion`, `namespace`, `modernAst`, `name`, `outputFilename`, `preserveComments`, `preserveWhitespace`, `fragments`, `hmr`, `sourcemap`;
- accepted with no effect: `runes: true`, `experimental.async: true`;
- an error naming the reason: `runes: false`, `experimental.async: false`, `accessors`, `immutable`, `compatibility.componentApi`;
- upstream's removed options keep upstream's errors (`legacy`, `format`, `tag`, `sveltePath`, `errorMode`, `varsReport`) and its removal warnings (`loopGuardTimeout`, `enableSourcemap`, `hydratable`).

**Parser and printer.** The first task is a probe deciding the JS/TS parser between `oxc-parser` and upstream's acorn with `@sveltejs/acorn-typescript`. It must give: parsing an expression starting at an offset whose end is unknown, with parentheses preserved — what the template parser does through `acorn.parseExpressionAt` (`src/compiler/phases/1-parse/acorn.js`); error-tolerant parsing for `loose`; upstream's ESTree shape; UTF-16 offsets for positions and sourcemaps; synchronous loading under `require`; running in a browser; and parse time on upstream's `compiler` benchmark inputs. Output is printed from ESTree with sourcemaps by `esrap` unless the probe gives a reason against it.

**Acceptance.**
- The validator, compiler-errors, parser-legacy, parser-modern, print, preprocess, sourcemaps, css and css-parse entries pass.
- An `#explanation` under the IR module states every IR node type with its `.svelte` form and its TSX form or "none yet".
- The import rule shows no relation from analysis or the transforms to the front end.
- The `compiler` benchmark meets the milestone's protocol.
