---
id: 01a1852f-ba89-7089-9ac3-30ea8cd5da81
title: "Two inputs into one template IR: frozen .svelte for compatibility, TSX with runes as the native format"
ord: 4
tags: ["idea"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: relates
    to: 01a1852f-ba89-7089-9ac3-30e788b9f5b3
---
The compiler reads two source forms into one template IR, with asymmetric roles: `.svelte` is the compatibility input, TSX with runes is Dromon's own format.

**`.svelte`, runes mode only, syntax frozen at upstream.** It carries the drop-in promise for runes code (an alias in the package manager), the runes part of the library ecosystem (Svelte libraries ship `.svelte` sources and are compiled by the app's compiler), upstream's runtime tests as the oracle for the scheduler, and Tagma's 807 `.svelte` files. A component without runes is a compile error: legacy mode and its syntax are out by default, so a library still written without runes does not build on Dromon until its authors migrate it. A compat layer for such components, as `preact/compat` is for React, is considered only if Dromon finds users and they ask for it. Because its syntax never grows, upstream tooling — `svelte-check`, the language server, the prettier plugin — keeps working on it. One condition: `svelte-check` loads the compiler from the package named `svelte` and svelte2tsx builds its TSX from `parse()` ([[88b9f5b3]]), so Dromon's `svelte/compiler` must keep `parse()` answering the upstream AST.

**TSX with runes, the native format, for its types.** TSX has no more room for new template syntax than frozen `.svelte` — it must stay valid TSX — and new APIs and runes work in both forms alike. What it gives is typing by TypeScript itself: generic components as generic functions, call sites checked by the component's parameter, callback and render-prop parameters inferred without annotations, any TS tool working on it as it is. TypeScript parses and checks it with no tooling of ours: runes are plain calls typed by ambient declarations, directives are namespaced attributes (`bind:value`, `use:action`) typed through the JSX namespace, events are plain `onclick` props as in runes-mode Svelte, and control flow is either ordinary expressions — ternary, `&&`, `.map()` — or control-flow components `Show`, `For` (with `fallback` for the empty list), `Switch` and `Match`, which the compiler recognises by their import and lowers to IR branches and lists, with no runtime component. The compiler also rewrites the script, so a rune is read and written as a plain variable, unlike Solid's getter calls. Probe on 2026-10-29, tsc 6.0.3 strict (probe file not kept): a component using `$props`, `$state`, `$derived`, `bind:value` and `on:click` checked clean (`on:` is a legacy directive, out of Dromon; it stood in the probe only as a namespaced attribute); `bind:value={count}` with a number and the typo `bind:valeu` were both reported.

**Props are the component function's parameter.** A TSX component receives its props as its first parameter, destructuring, defaults and rest included, and the compiler rewrites the destructured names into reactive prop reads as it does for `$props()` in `.svelte`; `$props()` belongs to `.svelte`, whose script has no signature. TypeScript types a JSX call site by the component's first parameter: probe on 2026-10-29, tsc 6.0.3 strict (probe file not kept) — with props taken by `$props()` inside the body, `<C label={1} />` and `<C />` checked clean against a required `label: string`; with props as the parameter, both were reported.

**Typing the whole surface is proven.** Probe on 2026-10-29, tsc 6.0.3 strict, with a minimal JSX namespace (probe file not kept): a generic `async function` component typechecked once `JSX.ElementType` admits `Promise<Element>`; `bind:query` on a component typechecked once `JSX.LibraryManagedAttributes` adds a `bind:` key per prop; a boundary element with `pending` and `failed` function props typechecked (written `<svelte:boundary>` in the probe, `Boundary` from `dromon` by design); `For`, `Switch`, `Match`, `Show`, `key` and class objects typechecked; the parameters of `row` and `onselect` callbacks were inferred from the generic. Reported, as meant: a property missing on the inferred type, a number bound to a `string` prop, a string method on a `number` list item.

**TSX names nothing of Svelte.** TSX components are `.tsx` files; `Boundary` and the control-flow components are imported from `dromon`; there is no `svelte:` element or `svelte` import in TSX code. The `svelte` name stays only on the compatibility path — `.svelte` files and the `svelte` package name that upstream tooling and libraries resolve. An app mixing both forms must still get one runtime instance, which a package-manager alias installing `dromon` twice under two names would break; how both specifiers reach one instance is designed with the TSX input.

**What TSX does not take.** Snippets are plain functions returning JSX; scoped `<style>` has no place yet — the open question of this path.

**Semantics are runes, not React.** No hooks, no re-render, no React libraries; the documentation needs a page on how this JSX differs from React. The story that can carry it: an app moves from `.svelte` to `.tsx` file by file inside one runtime, both forms importing each other, as TypeScript's `allowJs` let projects leave JS gradually.

**No language of our own.** An extended `.svelte` (the earlier `.dro` idea) would need its own svelte2tsx, language server, formatter and linter parser; TSX gives Dromon a typed form with none of that.

**The IR is two-input from day one.** Upstream's compiler keys its 62 analysis visitors and 54 client and 35 server transform visitors on Svelte's node types; JSX added to such a compiler later is a second compiler. Order of work: runtime and scheduler with their server side, the `.svelte` input (it brings the oracle) and Kit, the TSX input, native tooling last; server rendering, hydration and Kit are designed from the start, not after the client.
