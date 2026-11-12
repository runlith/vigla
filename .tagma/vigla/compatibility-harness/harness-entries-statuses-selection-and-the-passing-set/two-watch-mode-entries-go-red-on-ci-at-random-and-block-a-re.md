---
id: 01a1cdad-2e12-7877-bca3-c0546fa3fbc6
title: Two watch-mode entries go red on CI at random and block a release
ord: 8
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: discovered-from
    to: 01a1b93f-3d4c-7d83-bb93-773392723688
sources:
  - kind: file
    ref: harness/samples/own/kit/layout-load-types/test/watch.test.js
---
On 2026-11-12 the `release` run on commit `7420e5a4` went red in two shards while the `harness` run on the same commit was green, so `publish` was skipped until the failed jobs were rerun. Both entries write a source file and wait for a watcher to rebuild:

- `own/kit/layout-load-types/test/watch.test.js` — the 30 s poll for the regenerated `$types.d.ts` expired with the file's time unchanged; the same entry was the red of the run on 2026-11-05. The write follows `server.listen()` directly, so a watcher not yet ready is the first thing to rule out.
- `vite-plugin/e2e/build-watch/build-watch.spec.ts`, three tests of `edit files` — after an edit the page held none of the elements the test reads.

Find why each rebuild is missed and fix it at its producer — the entry's wait, the harness's setup or the product's watcher. Until then a release can stop on a commit the harness has already proven.