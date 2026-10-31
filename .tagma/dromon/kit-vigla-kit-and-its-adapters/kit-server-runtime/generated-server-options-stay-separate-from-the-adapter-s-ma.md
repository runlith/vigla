---
id: 01a193fc-1237-7215-837c-ef17603799c9
title: Generated server options stay separate from the adapter's manifest
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/types/internal/server.ts
---
The generated server entry binds `ServerOptions` to the runtime constructor so an adapter supplies only its manifest and platform inputs. Manifest assets and route loaders may change with the deployment, while the root component, front-end format, templates and policy belong to the build; combining them would make adapters reproduce compiler-owned decisions. The async-context port is a platform capability and belongs to initialization, with synchronous request lookup when it is absent.