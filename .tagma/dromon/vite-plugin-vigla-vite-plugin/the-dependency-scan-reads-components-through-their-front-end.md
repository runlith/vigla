---
id: 01a1a11a-eeec-7268-9b5d-68cd5e89df4f
title: The dependency scan reads components through their front end's parse
ord: 7
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a187cb-043a-7c9c-8057-8594c18ff125
sources:
  - kind: file
    ref: packages/vite-plugin/src/plugins/scan.ts
---
Vite's scanner reads a component by copying each `<script>` body verbatim into a module and re-exporting the module script, so a JavaScript module script that exports a snippet declared in the template fails the whole scan, and dependency pre-bundling is skipped. During the scan the plugin therefore loads each component whose front end exposes `parse` itself: it parses the raw source, and only when that fails, because a style needs its preprocessor, parses again with styles emptied through the front end's own `preprocess`. Neither compiling nor style preprocessing runs, since the scan needs only the scripts' imports.

Each script becomes its own module: the module script is re-exported and the instance script imported, as Vite does, because the instance script may shadow a module-script name, so one combined module would declare it twice. An exported name the script does not declare gets an empty binding. TypeScript scripts get a side-effect import per import declaration, because the TypeScript transform drops imports used only by markup. Script modules carry a query ending in `.js` or `.ts`, the only ids Vite's scanner expands `import.meta.glob` in.

A script naming another language or a `src`, a source the front end cannot parse, or a front end without `parse`, falls back to Vite's own path. The plugin object is shared by every optimizer build of an environment and the scan runs beside a pre-bundling build, so its `options` hook hands the scan a fresh hook plugin rather than mutating itself.
