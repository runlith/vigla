---
id: 01a1a13e-29ac-7b99-84cc-a8d468ed2686
title: Rebase imported style URLs in apps without a PostCSS config
ord: 9
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: discovered-from
    to: 01a19417-ef1d-76c1-9d8c-be96f41e1337
  - kind: relates
    to: 01a19546-eb2f-78ac-bee0-b37d64a80647
---
Rebase relative URLs in stylesheets that `vitePreprocess` inlines through `@import`, in apps that configure no PostCSS. The URL visitor is installed only into an app that already configures PostCSS (64a80647): installing it elsewhere makes Vite run PostCSS on every stylesheet, which made the virtual style map's `file` absolute and broke the recorded css-dev-sourcemap row. Handing `preprocessCSS` a derived config instead falls back to Vite's shared in-process preprocessor, whose aliases leak across projects. Find a way that keeps the app's resolved config identity and leaves ordinary CSS untouched. Add the no-PostCSS case to the own #1310 regression, which today always supplies `postcss.config.cjs`.
