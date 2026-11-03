---
id: 01a1a11f-d6b0-7ffb-b45f-16d0e8a306c6
title: The declarations omit every legacy API Vigla rejects, keeping only the types svelte2tsx constructs
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/svelte/types/runtime.d.ts
  - kind: file
    ref: packages/svelte/elements.d.ts
---
Anything Vigla turns into a compile error is left out of the declarations. An import or option Vigla rejects is then a type error at the same place the compiler would refuse it. That covers `createEventDispatcher`, `beforeUpdate`, `afterUpdate`, `spring`, `tweened`, `svelte/legacy`, `on:` element attributes, and the `accessors`, `immutable` and `compatibility` compile options. It also covers the class-component forms: `mount`'s `events` option and the `SvelteComponent` value. `svelte:fragment`, `svelte:self` and `svelte:component` are not declared either, but the custom-element index signature of `SvelteHTMLElements` accepts them, so `svelte-check` reports them only through the compiler's own diagnostic.

`SvelteComponent`, `ComponentConstructorOptions` and `ComponentType` remain as types only, because svelte2tsx's shims construct them; `SvelteComponent` is therefore an interface, and `class X extends SvelteComponent` is a type error. The `svelte/motion` type `Updater` and the `svelte/types/compiler/*` modules stay, because they carry no behaviour and third-party declarations still import them.
