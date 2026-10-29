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

**Public runtime API.** The core's entries — `dromon`, `dromon/server`, `dromon/reactivity`, `dromon/reactivity/window`, `dromon/motion`, `dromon/transition`, `dromon/animate`, `dromon/easing`, `dromon/events`, `dromon/attachments`, `dromon/action` — carry upstream's runes-mode API, minus what the milestone spec declares legacy; custom elements and boundaries included. A name carrying `Svelte` takes the core's own name in the core — `SvelteMap`, `SvelteSet`, `SvelteDate`, `SvelteURL` and `SvelteURLSearchParams` are `ReactiveMap`, `ReactiveSet`, `ReactiveDate`, `ReactiveURL` and `ReactiveURLSearchParams` — and every other name stays upstream's. The adapter re-exports each entry as its `svelte/*` counterpart under upstream's names, binding the same classes and functions, so code using both names shares one implementation.

**Kit's contract on the runtime**, designed now: the server `render(Root, { props, context, csp: { nonce } | { hash }, transformError })` returning `head`, `body` and `hashes.script`, as Kit's `runtime/server/page/render.js` calls it; the client `hydrate`, `mount`, `fork`, `settled`, `tick` and `onMount`, as Kit's `runtime/client/client.js` imports them.

**Formats the contract pins keep upstream's form**: hydration markers (`<!--[-->`, `<!--]-->` and the rest — the hydration samples feed hand-written ones through `_override.html`, some samples compare HTML with comments kept); the hydration-data script `(window.__svelte ??= {}).h` (the `csp-*` samples pin its text and the harness finds the script by it); the dev metadata `__svelte_meta`, the `$props.id()` text and the HMR symbol, which devtools and tooling read. Nothing outside Dromon argues for other forms.

**Animation time comes from `requestAnimationFrame`.** The runtime reads `requestAnimationFrame` at each use, never captured at module load, and takes animation time from the timestamps it passes — an animation starts at its first frame's — never from `performance.now`. Faking `requestAnimationFrame` alone fakes animation time, while `performance.now` stays real for code measuring real durations.

**Acceptance.**
- The runtime-runes, hydration, server-side-rendering, runtime-browser (custom elements and `test-ssr.ts` included), runtime-production, runtime-xhtml and motion entries pass.
- The runtime meets the milestone's performance targets.
