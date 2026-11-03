---
id: 01a19417-ef1d-76c1-9d8c-be96f41e1337
title: Resolve the six frozen Vite plugin defects at the fork base
ord: 4
tags: ["task"]
fields:
  {
    "holder": "tagma:01a184d8-1b37-7bfc-8899-05d6b3ce2282",
    "status": "in_work"
  }
edges:
  - kind: discovered-from
    to: 01a1863d-db39-787b-8f72-b03a2e546434
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
---
Resolve the six frozen plugin reports against vite-plugin-svelte 7.3.1 and Svelte 5.57.3, fixing Vigla's producer or routing another owner's cause. All six have fork-base failure evidence; none was dropped.

| Report | Fork-base evidence and retained public proof | Outcome |
| --- | --- | --- |
| #1394 | A public preprocessor reports `C:/external/mixins.pcss`; replaying a native-separator watcher change leaves the browser red, while the native-separator Sass control turns blue. `dependency events match normalized and native Windows paths` in `harness/samples/own/vite-plugin/test.ts`. This is a Darwin public-event replay, not a Windows filesystem/watch run. | Fixed dependency-key identity and proof in 307705b5; verified green on Vigla. |
| #1320 | The final child HMR notification arrives after a child-parent-child edit sequence, but the DOM stays at child two instead of child three. `parent replacement keeps child hot updates live`. | Vigla's implementation passes; public proof in 307705b5. |
| #1310 | A public build emits no asset for an imported stylesheet's relative image URL. `imported style URLs retain their source directory and scoping` covers nested imports, package assets, suffixes, scoping and app PostCSS processing, with and without a PostCSS config. | Rebase in 307705b5; full unconfigured-app coverage restored in a7171aa67e. The optional sourcemap `file` basename pin is an intentional difference; a contract passing on both targets retains exact imported/component sources and declaration positions. |
| #1254 | Development SSR changes the authored literal `<style>Style3</style>` into `<style>Style3 *{}</style>`. `style tags in strings retain their literal value`. | The plugin leaves source opaque (bf81a04d); public proof in 307705b5, verified green. |
| #1066 / duplicate #1356 | A fresh dev scan of a JavaScript module script exporting a template snippet reports `PARSE_ERROR: Export 'row' is not defined`. The earlier non-reproduction covered only `lang="ts"`; [[2e546434]] is corrected. `dependency scan crawls components exporting template snippets` also retains TypeScript imports, glob discovery, a preprocessed style, BOM and hoisted-var controls. | Parse-only scan and proof in 292a8979b5. |
| #1349 | The original five-route app hangs with one Rolldown worker on the fork base. A plugin-free Vite 8.2.2 / Rolldown 1.2.9 reduction with repeated aliased globs succeeds without an observer, but an ordinary `resolveId` observer awaiting `this.resolve` hangs (1/6 runs; returning the resolution hangs 3/6). Vigla's old Kit guard also hangs after its SSR build finishes. Retained original and reduced fixtures, scripts and outputs are under `/Users/teunlao/.tagma-dev/scratch/01a1a103-2b4a-75f6-9d50-3eaee6c597a1/issue-1349*`. | Graph-based guard and public build samples are written but uncommitted; the one approved landing check is queued. No dependency upgrade/fork or external contact was made. |

The committed plugin delivery passed eight own entries on Vigla, with all six intentional defect differences red on the fork base and the imported/component source-map contract green there. Focused recorded e2e projects passed: hmr 23, kit-node 27, css-dev-sourcemap 4 after moving its incidental `file` expectation to a difference, autoprefixer 2, and the five scan/prebundle/preprocessor projects 31. Plugin units passed 10 and its package tests 3; package type checks passed. Reviews found BOM offsets, var hoisting, published-package dependency identity and the unconfigured-PostCSS gap; all four were corrected. The current #1349 review found late graph validation and cyclic entry traversal; their corrections are written and await the landing check. Parse-only scan cost was sampled at roughly +0.2 ms/component on the 553-component basics corpus under concurrent load, accepted by the lead.
