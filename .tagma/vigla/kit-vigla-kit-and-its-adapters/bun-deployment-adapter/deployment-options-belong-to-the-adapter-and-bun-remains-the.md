---
id: 01a1944b-f713-7dd8-92e3-717157ba7804
title: Deployment options belong to the adapter and Bun remains the runtime boundary
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/adapter-bun/src/build.ts
  - kind: file
    ref: packages/adapter-bun/src/index.ts
  - kind: file
    ref: packages/adapter-bun/src/server.ts
---
Serializable listener defaults and executable-build controls are adapter configuration, not injected slices of Bun services. Environment values take precedence over listener defaults, and adapter-owned entrypoints and output locations take precedence over advanced build controls. Bun's named compile configuration is accepted whole; the application server receives Web requests, asset streams and the platform's async-context store.