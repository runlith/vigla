---
id: 01a19e94-3fcc-7cfe-a190-772241fb1c6b
title: Report entries upstream itself skips as their own state
ord: 22
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
---
Seven compiler entries are marked `contract` but never run because upstream skips them (`skip: true` or `it.skip`): validator `error-mode-warn` and three `it.skip` tests, parser-legacy `implicitly-closed-li-block`, sourcemaps `binding-shorthand` and `markup`. They can never pass, yet they are neither dropped (Vigla does not reject their construct) nor differences. The harness reports such entries as skipped by upstream, a state outside the contract count and the passing set, derived from the upstream test itself rather than written by hand, so a later upstream un-skip turns them back into contract entries.