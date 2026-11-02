---
id: 01a18775-3e82-7063-8ffa-aa9331a81701
title: Hydration claims the server's nodes with the same navigation calls that walk a fresh clone
ord: 1
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
sources:
  - kind: file
    ref: packages/vigla/src/runtime/dom/hydration.ts
  - kind: file
    ref: packages/vigla/src/runtime/dom/template.ts
  - kind: file
    ref: packages/vigla/src/compiler/client/template.ts
  - kind: file
    ref: packages/vigla/src/compiler/server/template.ts
---
Compiled client code navigates a template with one sequence of calls — `fragment()`, `first`, `child`, `sibling`, `next`, `reset`, `append` — that clones and walks a fresh copy when mounting and claims the server's nodes when hydrating, so client rendering and hydration cannot drift apart. While hydrating, `fragment()` returns the cursor instead of a clone and every navigation call moves the cursor, ignoring the node it was handed.

Rich children of a select, optgroup or option form a separate fragment ending at a server marker. A browser whose select parser strips rich descendants clears and mounts that fragment without hydration, then restores the cursor to the preserved element; a parser that preserves them claims the fragment in place.

The cursor obeys three positional rules the generated code depends on:
- A fragment's or element's navigation ends with the cursor on its last node: trailing static nodes are passed with `next(n)`, `reset(element)` returns the cursor to an element after its children and fails when server nodes remain after the last child, and `append` steps past the fragment's last node.
- A block stands at one position: the cursor reaches its open marker (`<!--[-->`, `<!--[n-->`, `<!--[!-->`), the block reads it, claims its arm or rows, and leaves the cursor on the close marker `<!--]-->`, which is its anchor from then on, so sibling navigation continues past it as if past the client template's `<!>`.
- A component or `{@render}` renders inline at its position, with no open marker: the server follows its content with `<!---->`, matching the client template's `<!>`, unless it is the only content of a fragment — a component's root, a block's arm or row, a snippet, component children — where it renders straight into the enclosing anchor on both sides. An element's only child is no such fragment unless the element's rich select content is split into a fragment: otherwise it is followed by `<!---->` like any other, since the client template holds a `<!>` there. A component whose reference can change is a block with open and close markers like `{#if}`.
- A text the server rendered empty has no node: the navigation call carries a `text` flag and creates the node in place. A fragment of a component root, each row, each fallback or component children that starts with text is preceded on the server by `<!---->`, which the client skips with `next()` before claiming, so the text is not fused with what precedes it.

`{#await}` opens with `<!--[-->` and its pending content when the server met a promise, and with `<!--[!-->` and its `then` content when it met any other value; the client adopts that arm only when its own input is of the same kind, else removes the server's content and renders its own.

`{#key}` has a single arm, so it carries no arm marker: the server writes its content between `<!---->` and `<!---->`, as upstream does, and the trailing comment becomes the block's anchor.

`<svelte:element>` is a block keyed by its tag with no arm marker either: the server writes `<!---->`, the element, `<!---->`, and inside the element its children followed by `<!---->` (none in `textarea`, `script`, `style` and `title`, whose content is raw text, so the client appends a temporary end comment while claiming them). The client's `<!>` claims the leading comment, the element is adopted as the block's content, and the trailing comment becomes its anchor; with no tag, only the two comments stand.

`{@html}` stands between `<!---->` (in `DEV`, `<!--<hash of the value>-->`) and `<!---->`: hydration adopts whatever the server wrote between them and never repairs it, warning `hydration_html_changed` in `DEV` when the client's value hashes differently, unless a `svelte-ignore` covers it. As an element's only child it sets `innerHTML` on that element instead of standing at an anchor, except inside a split rich select fragment.

A `{@const}` or `{let …}` whose value awaits splits its fragment on both sides: the declarations before it stay in place, and everything after it in that fragment, snippets included, is one async part standing at a single `<!>` position, written by the server between `<!--[-->` and `<!--]-->` as any content waiting on an `await`, so a later declaration may read the awaited one and the split repeats inside.

A server arm or `{#each}` branch other than the client's choice is not a mismatch: the block removes the server's content up to its close marker and renders its own. An empty child position supplies a text anchor, as empty server expressions have no text node. Structural validation failures warn `hydration_mismatch`; native DOM or construction errors are reported with their original value. Hydration destroys the failed owner and mounts a clean target after either kind of failure, or throws `hydration_failed` under `recover: false`. A framework diagnostic retains its identity and rethrows without a remount, independently of its adapter's printed form.
