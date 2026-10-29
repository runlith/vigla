---
id: 01a185b6-09f2-796e-90b2-9fad9ca8ebb2
title: "Compiler: front ends into a template IR naming semantics, client and server output"
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
**Pipeline.** A front end turns one source form into the template IR, the script ESTree and its syntax-bound diagnostics; analysis and client and server code generation read only those; CSS is scoped from the style AST. Front ends fill a port of the core: the `.svelte` front end lives in `@vigla/svelte` and is this milestone's only one; the TSX front end joins the core later ([[8cd5da81]]). No core module imports a front end.

**The `.svelte` front end keeps upstream's AST.** `parse()` answers the legacy format by default and the modern one with `modern: true`, as the parser suites pin; `loose: true` parses error-tolerantly, as svelte2tsx calls it and the `loose-*` samples pin. svelte2tsx reads the legacy format, so upstream tooling keeps working on `.svelte`. Its parser follows upstream's parser structure — the states, comment attachment, `{#each}` backtracking, loose recovery and the regexes that fix token boundaries — written in TypeScript under Vigla's names: the output is upstream's AST to the JSON, quirks included, and those mechanisms decide which nodes, positions and comments come out. This is the one carry-over rule [[864b44df]] allows here; it sits behind the port in the adapter, so nothing of the core's design rests on it. It is restructured only if the compiler benchmarks show parsing behind the performance targets, with upstream's parser suites and the differential corpus of mutated variants as acceptance. The front end owns what is bound to syntax — diagnostics such as `attribute_quoted`, `element_implicitly_closed` and `bidirectional_control_characters`, and the scopes of `svelte-ignore` comments, which the IR carries as data — and resolves global runes in `.svelte` and `.svelte.js`/`.svelte.ts`.

**The IR names semantics, not syntax**: branch, keyed list, unkeyed list, keyed block, async block, boundary, snippet and render, element, component, text, expression, attributes and directives, raw HTML, a template constant, a debug point, an attachment, the document title, the special targets (head, window, document, body), a dynamic element, component options and a custom element's slot — so the TSX front end lowers to the same nodes.

**`svelte/compiler`**, the adapter's API over the core, is upstream's minus `migrate`: `compile`, `compileModule`, `parse`, `parseCss`, `print`, `preprocess`, `VERSION`, with upstream's error and warning codes and messages. The core's own compile API is shaped with the TSX input; this milestone needs only what the adapter and Kit call (`parseCss` included).

**Options of the adapter's `compile`:**
- accepted as upstream's: `filename`, `rootDir`, `dev`, `generate`, `warningFilter`, `css`, `cssHash`, `cssOutputFilename`, `customElement`, `discloseVersion`, `namespace`, `modernAst`, `name`, `outputFilename`, `preserveComments`, `preserveWhitespace`, `fragments`, `hmr`, `sourcemap`;
- accepted with no effect: `runes: true`, `experimental.async: true`;
- an error naming the reason: `runes: false`, `experimental.async: false`, `accessors`, `immutable`, `compatibility.componentApi`;
- upstream's removed options keep upstream's errors (`legacy`, `format`, `tag`, `sveltePath`, `errorMode`, `varsReport`) and its removal warnings (`loopGuardTimeout`, `enableSourcemap`, `hydratable`).

**Parser and printer.** The core parses JS and TS with `acorn` and `@sveltejs/acorn-typescript`, chosen by a measured probe: one parser that gives expressions at an offset with an unknown end, TSX, upstream's ESTree shape, UTF-16 offsets, synchronous `require` and browsers. The JS parser is about a tenth of compile time, so the compile-time target is met in the front end, analysis, transforms and printing. Loose recovery of templates and comment attachment are the `.svelte` front end's own work, as upstream's, since the parser provides neither. Generated JS is printed by `esrap` with sourcemaps; it does not round-trip TSX source (`<T,>` loses its comma).

**Acceptance.**
- The validator, compiler-errors, parser-legacy, parser-modern, print, preprocess, sourcemaps, css and css-parse entries pass.
- An `#explanation` under the IR module states every IR node type with its `.svelte` form and its TSX form or "none yet".
- The import rule shows no relation from a core module to a front end.
- The compiler meets the milestone's performance targets.
