---
id: 01a1863c-0e2b-75ed-9e02-5a99132ffdf0
title: Browser samples run in Chromium from an esbuild bundle resolved against the target
ord: 3
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fab49056597
sources:
  - kind: dir
    ref: harness/src/browser
---
runtime-browser and custom-element samples assert what jsdom does not implement — layout sizes, media element bindings, iframes, computed styles, shadow DOM — so, like upstream's runner, the harness bundles each sample with esbuild and evaluates it in a Playwright Chromium page. The bundle resolves `svelte`, `vigla` and their subpaths through the target's package exports, client or server, with esbuild's `browser` and `production` conditions as upstream's build sets them; components compile without a filename, so their CSS hash is the hash of their CSS, as upstream's. The page driver mounts or hydrates through public API with a `$state` props object, where upstream's driver uses `createClassComponent`.

The `ssr` variant is upstream's `test-ssr.ts`, run in jsdom like the other server suites. Upstream registers it for every sample and returns without asserting when `mode` or `skip_mode` excludes the server, so its report counts those entries as passed; the harness registers and returns the same way, or the equality would differ on them.

Playwright is pinned to upstream's version so both runs use the one Chromium build it downloads; a different Playwright needs its own browser revision installed.
