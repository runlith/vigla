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

**Public runtime API.** The core's entries — `vigla`, `vigla/server`, `vigla/reactivity`, `vigla/reactivity/window`, `vigla/motion`, `vigla/transition`, `vigla/animate`, `vigla/easing`, `vigla/events`, `vigla/attachments`, `vigla/action` — carry upstream's runes-mode API, minus what the milestone spec declares legacy; custom elements and boundaries included. A name carrying `Svelte` takes the core's own name in the core — `SvelteMap`, `SvelteSet`, `SvelteDate`, `SvelteURL` and `SvelteURLSearchParams` are `ReactiveMap`, `ReactiveSet`, `ReactiveDate`, `ReactiveURL` and `ReactiveURLSearchParams` — and every other name stays upstream's. The adapter re-exports each entry as its `svelte/*` counterpart under upstream's names, binding the same classes and functions, so code using both names shares one implementation.

**Kit's contract on the runtime**, designed now: the server `render(Root, { props, context, csp: { nonce } | { hash }, transformError })` returning `head`, `body` and `hashes.script`, as Kit's `runtime/server/page/render.js` calls it; the client `hydrate`, `mount`, `fork`, `settled`, `tick` and `onMount`, as Kit's `runtime/client/client.js` imports them.

**Formats the contract pins keep upstream's shape**: hydration markers (`<!--[-->`, `<!--]-->` and the rest — the hydration samples feed hand-written ones through `_override.html`, some samples compare HTML with comments kept); the hydration-data script (the `csp-*` samples pin its text and the harness finds the script by it); the dev metadata on elements, the `$props.id()` text and the HMR symbol, which devtools and tooling read.

**Names in formats belong to the front end's world.** A native app shows nothing of Svelte, in the DOM and on `window` included: the core names its globals and properties in its own words (`window.__vigla`, `__vigla_meta`). An app reached through `svelte` gets upstream's names — `(window.__svelte ??= {}).h`, `__svelte_meta`, `window.__svelte.v` — because the adapter's `svelte/*` entries and its compiler hand the core the names for what they render, compile and hydrate: a runtime parameter of `render`, `hydrate` and `mount` and a compile option, never a global switch, so a page rendered through one name is hydrated through the same one.

**Animation time comes from `requestAnimationFrame`.** The runtime reads `requestAnimationFrame` at each use, never captured at module load, and takes animation time from the timestamps it passes — an animation starts at its first frame's — never from `performance.now`. Faking `requestAnimationFrame` alone fakes animation time, while `performance.now` stays real for code measuring real durations.

**Acceptance.**
- The runtime-runes, hydration, server-side-rendering, runtime-browser (custom elements and `test-ssr.ts` included), runtime-production, runtime-xhtml and motion entries pass.
- The runtime meets the milestone's performance targets.
