---
id: 01a1a42a-e4e4-71fe-ad86-b8a11615b8d6
title: Option types of `$app/*` functions the facade wraps are interfaces declared in Kit's ambient modules, so the facade widens them by merging
ord: 8
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a1a3ed-6688-7f72-8a35-40a5ff420c2e
sources:
  - kind: file
    ref: packages/kit/types/index.d.ts
  - kind: file
    ref: packages/sveltekit/types/history.d.ts
---
The facade's wrappers accept SvelteKit's retired options (`goto`'s `replaceState` and `invalidateAll`, `update({ invalidateAll })` of `enhance`). For an app under the facade to type-check those calls, its declarations merge the extra members into the very types Kit's `goto` and `enhance` signatures name. A merge reaches only an interface declared in the ambient module it augments, never a type that module re-exports from `#types/*`, so Kit declares `GotoOptions` and `FormUpdateOptions` there as interfaces extending its own, and makes `SubmitFunction` generic over the update options so the shape keeps one owner. Kit's own apps load no facade declarations and keep rejecting the retired options.