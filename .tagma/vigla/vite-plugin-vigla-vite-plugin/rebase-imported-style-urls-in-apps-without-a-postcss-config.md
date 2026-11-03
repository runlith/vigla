---
id: 01a1a13e-29ac-7b99-84cc-a8d468ed2686
title: Rebase imported style URLs in apps without a PostCSS config
ord: 9
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1a103-2b4a-75f6-9d50-3eaee6c597a1",
    "status": "done"
  }
edges:
  - kind: discovered-from
    to: 01a19417-ef1d-76c1-9d8c-be96f41e1337
  - kind: relates
    to: 01a19546-eb2f-78ac-bee0-b37d64a80647
---
Restore imported CSS URL rebasing for apps without PostCSS. The extended own asset regression failed on 292a8979 with `imported-image: expected undefined to be defined` and passes with the URL visitor restored for both configured and unconfigured apps. The upstream basename-only `map.file` assertion is an intentional difference: Vite makes that optional label absolute once PostCSS runs. The own `preprocessed styles map imported and component declarations` contract passes on both targets, preserves exact sources `['foo.scss', 'App.svelte']`, and checks both declaration line/column positions. This resolves the remaining confirmed Sol finding without narrowing #1310.