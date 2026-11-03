---
id: 01a19419-5e20-7e6b-87b3-974324eedb22
title: Navigation commits only after its render code is ready and still current
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/client/client.ts
  - kind: file
    ref: packages/kit/src/client/view.ts
---
A delayed error-component import can finish after a newer navigation has landed, so preparing a view cannot mutate the page, render tree or history. The router checks its navigation or invalidation token after preparation and then commits synchronously; otherwise the URL in history and the rendered page can belong to different navigations.