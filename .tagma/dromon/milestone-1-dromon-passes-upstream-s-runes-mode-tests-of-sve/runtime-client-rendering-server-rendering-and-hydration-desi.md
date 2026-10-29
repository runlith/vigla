---
id: 01a185b6-09f2-796e-90b2-9faeec26636a
title: "Runtime: client rendering, server rendering and hydration designed together"
ord: 5
tags: ["spec"]
fields:
  {
    "status": "open"
  }
---
**Designed together.** Client rendering, server rendering and hydration are designed as one: both outputs come from the same IR, and hydration reads what the server writes. Server rendering is async-capable, as `render()` is upstream with async on.

**Public runtime API** is upstream's runes-mode API of `svelte`, `svelte/server`, `svelte/reactivity`, `svelte/reactivity/window`, `svelte/motion`, `svelte/transition`, `svelte/animate`, `svelte/easing`, `svelte/events`, `svelte/attachments` and `svelte/action`, minus what the milestone spec declares legacy; custom elements and `<svelte:boundary>` included.

**Hydration markers** are Dromon's own format unless the harness shows that upstream's HTML comparison pins upstream's markers; that is decided once the harness runs.

**Acceptance.**
- The runtime-runes, hydration, server-side-rendering, runtime-browser (custom elements included), runtime-production, runtime-xhtml and motion contracts pass.
- Upstream's `reactivity` and `ssr` benchmarks meet the milestone's benchmark criterion.
