---
id: 01a19469-dc0c-725d-b2ff-62c5bc6f57de
title: Built application evaluation is isolated from Vite while policy closures remain in its process
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/build/worker.ts
  - kind: file
    ref: packages/kit/src/build/worker-entry.ts
  - kind: file
    ref: packages/kit/src/build/jobs.ts
  - kind: file
    ref: packages/kit/src/build/runtime.ts
  - kind: file
    ref: packages/kit/src/build/prerender.ts
---
Analysis, prerendering and fallback load the built app in fresh workers so its module cache, globals and background work cannot contaminate Vite or a later build. Policy decisions cross IPC to the original parent closures; a throwing callback rejects the build and terminates the worker. The prerender worker reloads a file-backed app config through the app's Vite installation solely to obtain its adapter emulator, whose live platform bindings cannot cross IPC. A programmatic config without a file prerenders without an emulator. Node's structured IPC preserves result maps and route regular expressions.