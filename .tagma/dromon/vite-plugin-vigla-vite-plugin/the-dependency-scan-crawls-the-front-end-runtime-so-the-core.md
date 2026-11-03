---
id: 01a1a138-64d8-7e2c-8520-e62ad16c46b9
title: The dependency scan crawls the front-end runtime so the core's own dependencies are pre-bundled
ord: 8
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a19477-067a-732a-8359-248221af373c
sources:
  - kind: file
    ref: packages/vite-plugin/src/plugins/runtime-scan.ts
---
Excluding the core from pre-bundling hides its own dependencies, such as `esm-env` and `clsx`, from Vite: the browser first meets them when it loads the core's source, and Vite then re-optimizes and reloads the page mid-session. During the dependency scan the plugin therefore adds the front ends' client entries as a scan input and crawls them and every core or front-end specifier they import as source, while the core's own bare imports stay ordinary scan results. Those dependencies are pre-bundled in the first optimization, the core itself remains external, and the list follows the core's actual imports with nothing declared beside them.

The crawl must precede the shared-core externalization in the optimizer's plugin list: that hook also runs during the scan and would mark every core import external before the crawl saw it. A front end excluded by `optimizeDeps.exclude` contributes no entries.
