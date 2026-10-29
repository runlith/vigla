---
id: 01a1868a-e2b1-75a8-92fb-02ece36e5eb5
title: A front end hands the core resolved runes, offsets into its source and `CompileError`s
ord: 2
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fad9ca8ebb2
sources:
  - kind: file
    ref: packages/dromon/src/compiler/ir/port.ts
  - kind: file
    ref: packages/dromon/src/compiler/ir/script.ts
---
The core reads a unit and decides nothing by source syntax; three parts of the port carry what a front end alone can know.

**Runes are resolved by the front end.** `runes` maps the callee node of each call the front end resolved as a rune — an `Identifier`, or a `MemberExpression` for dotted runes such as `$state.raw` — to its name. `.svelte` resolves a rune name no binding in scope shadows — a parameter or a local inside a function may, a `$`-prefixed declaration outside functions is `dollar_prefix_invalid` — and TSX will resolve by import binding; either way a local function called `$state` stays a function. The core consults only the map, keyed by node identity, so a unit must carry the same ESTree objects it resolved.

**Positions are offsets into the unit's `source`.** Every IR and ESTree node's `start` and `end` are UTF-16 offsets into the whole source text. `parseProgram` parses a script where it stands, the text before it blanked to spaces with newlines kept, rather than a slice: offsets, lines and source maps need no shifting, and a template expression parsed at its offset agrees with them.

**Failures are `CompileError`s carrying a `Diagnostic`.** A front end and the core throw the same class, with upstream's code where upstream has one, `js_parse_error` from the JS parser and `unsupported` for what the core cannot compile yet. An adapter rethrows it in its own world's shape — the Svelte adapter as upstream's `CompileError` with line and column and the `https://svelte.dev/e/<code>` line — so the core names no adapter's URL.
