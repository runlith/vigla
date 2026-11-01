---
id: 01a19475-1861-7756-b756-e06f869d45d9
title: Kit's own files are not application remote modules
ord: 5
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/kit/src/vite/paths.ts
    symbol: isRemoteModule
---
Kit may be linked from a workspace outside `node_modules`, and its internal files can have remote-module filenames. Treating those files as app remotes would inject runtime registration into Kit itself and turn shared code into a server dependency.