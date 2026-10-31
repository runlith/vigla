---
id: 01a193ed-396f-73b6-bbe3-bad6c301208d
title: Kit `@vigla/kit` and its adapters
ord: 23
---
The published package `@vigla/kit`, installed under the alias `@sveltejs/kit`, and the node, bun and static adapters: routing, `load`, server rendering and hydration, prerendering, form actions, hooks, remote functions and the Vite plugin `sveltekit()`, as SvelteKit 3.1 has them for runes code. Its server runtime answers a Web `Request` with a `Response` and leaves every platform's glue to that platform's adapter; it imports the core `vigla` and `@vigla/vite-plugin` and no front end.