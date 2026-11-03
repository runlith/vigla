---
id: 01a1a144-1b41-772a-93cb-c6653baa0b8c
title: Prove or drop the 22 frozen Kit SSR, streaming, header, hook and endpoint reports
ord: 7
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1a145-958a-7df6-9bee-761297384b53",
    "status": "in_work"
  }
edges:
  - kind: discovered-from
    to: 01a1863d-db39-787b-8f72-b03a2e546434
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
---
Frozen Kit reports of [[2e546434]] in this area with no test and no recorded non-reproduction (22). M1 ([[658ccea4]]) needs each one either reproduced on Kit 3.1.0 / Svelte 5.57.3 and fixed with a public regression red upstream and green on Vigla (an `own/kit` difference sample, as `layout-data` does for #17383), or removed from the list with a non-failing fork-base reproduction recorded in [[2e546434]]. The research executed no Kit reproductions; each row's evidence is upstream's report as read on 2026-10-29.

- [#9235 Missing CSP header for pre-rendered streamed promises](https://github.com/sveltejs/kit/issues/9235) · mode-independent · [stackblitz](https://stackblitz.com/edit/streaming-prerender-bug?file=src/routes/+page.server.js) · Maintainer (2023-02) said prerendered pages need the CSP built after buffering; no decision.
- [#9481 Server hook is not running during `preview`](https://github.com/sveltejs/kit/issues/9481) · mode-independent · [stackblitz](https://stackblitz.com/edit/sveltejs-kit-template-default-rgubuf?file=src%2Froutes%2F%2Bpage.svelte,src%2Froutes%2Flogin%2F%2Bpage.svelte,src%2Fhooks.server.ts&terminal=dev) · Maintainer (2023-03) said preview behaviour is correct and dev should be aligned; no fix recorded.
- [#11061 The `link` HTTP header in SSR breaks the import maps](https://github.com/sveltejs/kit/issues/11061) · mode-independent · [repo](https://github.com/hronro/sveltekit-http-link-importmap-issue) · No maintainer reply. The header originates in Kit SSR per the report; not re-checked in source.
- [#11648 Prerender with `reroute` and `trailingSlash="always"`](https://github.com/sveltejs/kit/issues/11648) · mode-independent · [sveltelab](https://www.sveltelab.dev/zq5pv5rncgy0obm) · Zero comments; the build passes without `trailingSlash`. Reroute code is INLINE in the [body](https://github.com/sveltejs/kit/issues/11648#issue-2084526126).
- [#11747 Svelte cannot produe safe CSP for default build / any inline styles](https://github.com/sveltejs/kit/issues/11747) · mode-independent · INLINE [body](https://github.com/sveltejs/kit/issues/11747#issue-2103515312) · Maintainer (2026-01) lists open tasks: removing the announcer's inline styles (PR #14566, unverified). Hashing user inline styles is a separate issue (#5215).
- [#11813 Inconsistent behaviour when changing headers of generated response](https://github.com/sveltejs/kit/issues/11813) · mode-independent · [repo](https://github.com/evestera/sveltekit-headers-sent-repro) · Zero comments.
- [#13226 Handle cases when location.protocol is `about:` or `data:`](https://github.com/sveltejs/kit/issues/13226) · mode-independent · INLINE [body](https://github.com/sveltejs/kit/issues/13226#issue-2755294899) · Maintainer (2025-01) said changes are needed to avoid the invalid base URL error; not fixed.
- [#14063 `transformPageChunk` semantics are broken with error page rendering](https://github.com/sveltejs/kit/issues/14063) · mode-independent · [repo](https://github.com/ckiee/svelte-reprod-transformPageChunk-done) and [gist](https://gist.github.com/ckiee/41e8d84cef29df2055ddf20206934125) · Zero maintainer replies.
- [#14249 `Could not get the request store` During Server Test](https://github.com/sveltejs/kit/issues/14249) · mode-independent · [repo](https://github.com/systemcarl/sveltekit-issue-get-request-store) · A contributor (2025-08) says `sequence` will stop relying on AsyncLocalStorage; PR #15671 unverified.
- [#14357 False-positive `Placing %sveltekit.body% directly inside <body> is not recommended` warning](https://github.com/sveltejs/kit/issues/14357) · runes · [repo](https://github.com/MathiasWP/sveltekit-false-positive-body-inside-body-warning) · Svelte's nesting warning is real; Kit's body-placement message is the misreported one. No maintainer reply.
- [#14782 Wrong relative path in `%sveltekit.assets%` with "malformed" url](https://github.com/sveltejs/kit/issues/14782) · mode-independent · INLINE [body](https://github.com/sveltejs/kit/issues/14782#issue-3537371634) · Zero maintainer replies; workaround `kit.paths.relative: false`.
- [#15196 Server fetch ignore init if first param is a Request](https://github.com/sveltejs/kit/issues/15196) · mode-independent · INLINE [body](https://github.com/sveltejs/kit/issues/15196#issue-3840840321) · A contributor (2026-09) links PR #17100; merge unverified.
- [#17004 experimental:tracing+async conflicts](https://github.com/sveltejs/kit/issues/17004) · async · [repo path](https://github.com/fredrik-stock/repros/tree/main/ssr-ondestroy-crash) · No maintainer reply.
- [#17193 `handle` runs outside the error boundary for undecodable paths, so a `redirect()` thrown in `handle` crashes the server](https://github.com/sveltejs/kit/issues/17193) · mode-independent · INLINE [body](https://github.com/sveltejs/kit/issues/17193#issue-5558992220) · No maintainer reply. Reporters (2026-10) report it on 3.0.x and with adapter-bun.
- [#17403 Browsers can block stylesheets from a cross-origin `paths.assets` after client-side navigation](https://github.com/sveltejs/kit/issues/17403) · kit3 (kit 3.0.1) · [repo](https://github.com/55Kamiryo/sveltekit-css-cors-repro) · Zero comments; the reporter opened PR #17404 (unverified).
- [#9154 Defer not working properly when multiple promises are returned](https://github.com/sveltejs/kit/issues/9154) · mode-independent · [repo](https://github.com/paoloricciuti/sveltejs-kit-defer-test) and [stackblitz](https://stackblitz.com/edit/sveltejs-kit-template-default-8zcefh?file=src/routes/+page.server.ts) · Maintainer (2023-02) called it a Svelte core limitation; a maintainer (2023-03) said browsers batch small chunks. No fix.
- [#10714 memory leak in adapter node with unresolved promises](https://github.com/sveltejs/kit/issues/10714) · mode-independent · [repo](https://github.com/lovasoa/sveltekit-memory-leak-bugreport) · Owner split (Svelte codegen vs Kit). Maintainer (2023-09) says unhandled rejections must be handled or the server crashes. No decision.
- [#10779 async errors report the wrong location during SSR](https://github.com/sveltejs/kit/issues/10779) · mode-independent · [stackblitz](https://stackblitz.com/edit/sveltejs-kit-template-default-wsaice?file=jsconfig.json) · A contributor's analysis (Node and Vite async stack limits); no maintainer reply.
- [#11842 POST endpoints should work with a request with missing `content-type` headers](https://github.com/sveltejs/kit/issues/11842) · mode-independent · [repo](https://github.com/HydrofinLoewenherz/sveltekit-bug-body-null) · No maintainer reply. The reporter reads the null body for a missing content type as deliberate.
- [#12184 Assets path not replaced by _svelte_kit_assets in preview](https://github.com/sveltejs/kit/issues/12184) · mode-independent · [repo](https://github.com/drzax/assets-repro) · Maintainer (2024-10) raised consistency with `_svelte_kit_assets` and possibly documenting it; undecided.
- [#11714 adapter-node: bad request errors are swallowed](https://github.com/sveltejs/kit/issues/11714) · mode-independent · INLINE [body](https://github.com/sveltejs/kit/issues/11714#issue-2094913305) · Conditional on the node/static adapter decision. Maintainer (2024-01) linked #9702; no decision.
- [#16230 adapter-node 5.5.7: "delete existing socket file on startup" (#15449) breaks SOCKET_PATH under Node cluster / PM2 cluster mode](https://github.com/sveltejs/kit/issues/16230) · mode-independent · INLINE [body](https://github.com/sveltejs/kit/issues/16230#issue-4802698185) · Conditional on the node/static adapter decision. No maintainer reply.
