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

**Public runtime API.** The core's entries — `dromon`, `dromon/server`, `dromon/reactivity`, `dromon/reactivity/window`, `dromon/motion`, `dromon/transition`, `dromon/animate`, `dromon/easing`, `dromon/events`, `dromon/attachments`, `dromon/action` — carry upstream's runes-mode API under upstream's names, minus what the milestone spec declares legacy; custom elements and boundaries included. The adapter re-exports each as its `svelte/*` counterpart.

**Kit's contract on the runtime**, designed now: the server `render(Root, { props, context, csp: { nonce } | { hash }, transformError })` returning `head`, `body` and `hashes.script`, as Kit's `runtime/server/page/render.js` calls it; the client `hydrate`, `mount`, `fork`, `settled`, `tick` and `onMount`, as Kit's `runtime/client/client.js` imports them.

**Hydration markers keep upstream's format** (`<!--[-->`, `<!--]-->` and the rest): the hydration samples feed hand-written upstream markers through `_override.html`, some samples compare HTML with comments kept, and nothing outside Dromon reads the markers to argue for another format.

**Lazy environment reads.** The runtime reads `requestAnimationFrame`, `performance.now` and the microtask queue at each use, never captured at module load, so tests and embedders can replace them.

**Acceptance.**
- The runtime-runes, hydration, server-side-rendering, runtime-browser (custom elements and `test-ssr.ts` included), runtime-production, runtime-xhtml and motion entries pass.
- The runtime meets the milestone's performance targets.
