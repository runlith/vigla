---
id: 01a19437-ffe2-7157-9291-e43814fe7e5e
title: A fatal error template ends the app whose DOM it replaces
ord: 4
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/client/client.ts
  - kind: file
    ref: packages/kit/src/client/view.ts
---
The static error template receives an HTML-escaped message. Once that replacement is applied, the tab owner is disposed because its mounted tree, navigation listeners and polling still refer to the removed app; an older navigation cannot replace the document after a newer one has committed.