---
id: 01a1868a-e2b0-7beb-b51f-7ccf553dc3c5
title: Every template IR node type has a `.svelte` form and a TSX form or none yet
ord: 1
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a1852f-ba89-7089-9ac3-30ea8cd5da81
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fad9ca8ebb2
sources:
  - kind: file
    ref: packages/dromon/src/compiler/ir/nodes.ts
---
The IR names what a template means, so every front end lowers to the same nodes and analysis and generation never branch on the source form. TSX forms are those [[8cd5da81]] agreed; "none yet" means no TSX spelling is decided.

| Node | `.svelte` | TSX |
|---|---|---|
| `Branch` | `{#if}…{:else if}…{:else}…{/if}` | ternary, `&&`, `Show`, `Switch` with `Match` |
| `KeyedList` | `{#each items as item, i (key)}…{:else}…{/each}` | `.map()` or `For`, with a `key` |
| `UnkeyedList` | `{#each}` without a key | `.map()` or `For` without a key; `For`'s `fallback` |
| `KeyedBlock` | `{#key expr}…{/key}` | none yet |
| `AsyncBlock` | `{#await p}…{:then v}…{:catch e}…{/await}` | none yet |
| `Boundary` | `<svelte:boundary>` | `<Boundary>` imported from `dromon` |
| `Snippet` | `{#snippet name(params)}…{/snippet}` | a function returning JSX |
| `Render` | `{@render name(args)}` | calling that function in JSX |
| `Element` | `<div …>` | `<div …>` |
| `Component` | `<Widget …>`, `<ns.Widget …>` | `<Widget …>` |
| `Text` | text, entities decoded | JSX text |
| `Expression` | `{expr}` | `{expr}` |
| `Comment` | `<!-- … -->` | none yet |
| `Property`, `Spread` | `name="…"`, `name={…}`, `name="a {b}"`, `{...rest}` | attributes and spread |
| `Binding`, `ClassToggle`, `StyleProperty`, `Action`, `Transition`, `Animation` | `bind:`, `class:`, `style:`, `use:`, `transition:` / `in:` / `out:`, `animate:` | namespaced attributes (`bind:value`, `use:action`) |
| `Attachment` | `{@attach fn}` on an element | none yet |
| `RawHtml` | `{@html expr}` | none yet |
| `Constant` | `{@const x = expr}` | none yet |
| `Declaration` | `{let x = expr}`, `{const x = expr}` | none yet |
| `Debug` | `{@debug a, b}` | none yet |
| `Title` | `<title>` inside `<svelte:head>` | none yet |
| `Special` | `<svelte:head>`, `<svelte:window>`, `<svelte:document>`, `<svelte:body>` | none yet |
| `DynamicElement` | `<svelte:element this={tag}>` | none yet |
| `Options` | `<svelte:options>` | none yet |
| `Slot` | `<slot>` inside a custom element | none yet |

What the table cannot show:
- A `Branch` holds its arms in order with one optional fallback: an `{:else if}` chain, like a nested ternary, is one node, so generation emits one block and one hydration marker per arm index.
- Keyed and unkeyed lists are separate types because they reconcile differently: a keyed row follows its key and moves; an unkeyed row stays at its position and its item is updated.
- An event handler is a `Property` named `on…`, as in runes-mode `.svelte` and in TSX props; analysis decides it is an event, so no event directive exists.
- `Component` covers dynamic components too: its reference is an expression, and analysis decides whether it can change.
- The three forms of a `Property` value are distinct meanings: `name` alone is boolean, `name={x}` passes the value as it is, `name="a {b}"` builds a string.
- `Comment` reaches output only with `preserveComments`; without it whitespace cleaning drops it.
- `Options` stands on the unit, not in the template; `svelte-ignore` scopes are the unit's `ignores`, not nodes; the component's style sheet is the unit's `style`, plain CSS syntax with offsets into the unit's source, which every front end hands over in the same shape.
