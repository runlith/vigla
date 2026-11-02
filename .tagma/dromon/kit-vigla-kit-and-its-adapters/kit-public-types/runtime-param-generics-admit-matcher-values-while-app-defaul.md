---
id: 01a19415-4975-7647-bc55-969c57cc314e
title: Runtime param generics admit matcher values while app defaults stay generated
ord: 3
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/types/navigation.ts
  - kind: file
    ref: packages/kit/src/types/request.ts
  - kind: file
    ref: packages/kit/src/types/state.ts
---
Route-agnostic runtime code must represent the primitive values returned by matchers, but app-authored callbacks use their generated route types. The generic bounds therefore admit all param values while the defaults retain `LayoutParams<'/'>`; the shallow destination also retains that generated map because its route may differ from the current page's narrower params.