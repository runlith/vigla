---
id: 01a187a0-88e3-7934-8a68-7015ccd85d5d
title: Stage block changes per batch and render keyed, each, await and transition blocks with no state left after unmount
ord: 3
tags: ["task"]
fields:
  {
    "holder": "tagma:01a187a1-663d-7ecf-8b80-4a63c27a8594",
    "status": "done"
  }
edges:
  - kind: discovered-from
    to: 01a18752-ff03-7988-bdb3-d51034d8c1ab
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
---
The block half of rendering, split from 34d8c1ab: every structural block (`{#if}`, `{#each}` keyed, unkeyed and without an item name, `{#key}`, `{#await}`, boundaries, dynamic components) staged per batch so a held batch's structure commits with it; transitions and animations with the core's `vigla/transition`, `vigla/animate` and `vigla/easing` entries and their `svelte/*` counterparts; `$props.id()` numbered per mount and per `render()` call with nothing on `window` between mounts; no async work left pending once an unmounted tree settled. Done when the entries 2d70f268e9 made pass are recorded without breaking recorded ones in suite order, and the transition and block entries of runtime-runes, hydration and SSR pass.