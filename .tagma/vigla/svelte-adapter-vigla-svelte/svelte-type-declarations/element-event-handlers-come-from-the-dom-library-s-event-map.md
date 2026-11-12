---
id: 01a1cdca-5c1e-7813-8cbc-97556e8b53ef
title: Element event handlers come from the DOM library's event maps, with upstream's event type wherever upstream declares another
ord: 3
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/svelte/elements.d.ts
---
`svelte/elements` builds every `on<event>` attribute from the DOM library's event maps, so a new platform event needs no line here. Upstream writes its list by hand, and for some events declares a wider type than the platform's map: `click`, `auxclick` and `contextmenu` are `MouseEvent`, where the map says `PointerEvent`; `scroll` and `scrollend` are `UIEvent`; `input`, `abort`, `progress` and `encrypted` are `Event`. Code written against upstream forwards such an event to a handler prop — a dialog trigger calling its `onclick` with the `MouseEvent` it received — and stops compiling when the prop asks for the narrower platform type. `DeclaredEventMap` therefore states upstream's type for each of those events, and the events upstream declares that the maps lack, and replaces the map's entries with them.

What still differs from upstream 5.57.3, measured by comparing the handler parameter of every `on*` key: `onload` and `onerror` give `currentTarget` the element's own type where upstream gives `Element`; the window and document attributes carry no transition events, which never fire there; and the maps add events upstream does not list, such as `animationcancel`, `command` and `slotchange`.