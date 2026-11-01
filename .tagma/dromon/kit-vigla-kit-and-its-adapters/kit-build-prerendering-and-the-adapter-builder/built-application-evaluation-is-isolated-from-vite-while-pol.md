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
---
Analysis, prerendering and fallback each load the built app in a fresh worker so its module cache, globals and background work cannot contaminate Vite or a later build. Policy decisions cross IPC back to the original configuration closures instead of reloading a Vite config or trying to serialize functions; this also supports programmatic configurations without a config file. A callback that throws rejects the build in the parent and terminates the worker. Node's structured IPC carries the result maps and route regular expressions without flattening their types.