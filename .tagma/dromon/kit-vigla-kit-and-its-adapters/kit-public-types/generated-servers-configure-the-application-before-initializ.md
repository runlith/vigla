---
id: 01a193fc-1237-7215-837c-ef17603799c9
title: Generated servers configure the application before initializing hooks
ord: 4
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/types/internal/server.ts
---
Adapters and preview configure the generated public server before initializing hooks; instrumentation may retain only its public exports, so private compiler options cannot be the deployment startup API. The root component, front-end format, templates and policy remain build-owned while the deployment supplies its manifest and platform capabilities. Configuration establishes environment, paths and build/prerender flags before user environment declarations and hooks evaluate; async-context ports remain platform inputs.