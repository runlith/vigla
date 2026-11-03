---
id: 01a18790-2322-71a0-bdb0-b62ddbc3f39d
title: An element carries its component's scoping class when any selector of the sheet may match it
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/compiler/css/marks.ts
  - kind: file
    ref: packages/vigla/src/compiler/css/prune.ts
  - kind: file
    ref: packages/vigla/src/compiler/css/relations.ts
  - kind: file
    ref: packages/vigla/src/compiler/css/template.ts
  - kind: symbol
    ref: packages/vigla/src/compiler/css/index.ts
    symbol: analyzeStyle
---
Outside hot replacement, whether an element is scoped is decided by matching every selector of the sheet, right to left, against every element of the component. The match is a "may match": an attribute whose value cannot be enumerated, a spread, a `bind:` of the attribute, a `{@render}` or component whose snippets cannot be resolved, a sibling inside a block that may not render — each counts as a possible match. So the class can land on an element no rule styles at runtime, never the reverse: a selector that could apply is never pruned and an element it could reach always carries the class. Elements inside `<svelte:head>` are never scoped, since head content is not the component's. With hot replacement and external CSS, the compiler scopes every other element of a styled component: changing a selector can then update only the stylesheet without changing which template nodes carry the class. This is an IR-level decision, so the Vite plugin need not rewrite any front end's source syntax.

A `{@render}` or a component reaches only the snippets its name resolves to lexically: a snippet in an enclosing fragment, nothing for an import, a prop or an undeclared global; any other name (a script variable, an each item, a snippet parameter) reaches every snippet of the component, as upstream does.

The facts the decision produces — which selectors are used, which compound selectors get the class, which rules are `:global` blocks — live in side tables keyed by the IR's style nodes, never on the nodes: a front end may hand over its parse objects as they are, and the `.svelte` adapter's `parse()` output must stay equal to upstream's.

Generation reads only `Scoping`: the class name and the set of scoped elements. Client and server must append the class the same way — after a static class, as the whole class when there is none, through the class setter for a dynamic class or `class:` directives, and with a spread's attributes — or server markup and the client template disagree when hydrating.
