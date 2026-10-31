---
id: 01a19446-488c-7f5c-ad9a-611a90a6fd93
title: Deployment output bundles the platform glue without a Kit package lookup
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/adapter-node/src/index.ts
---
The application may install Kit under either published name. Adapter runtime code is bundled during adaptation, while the already built application server is imported from the deployment's own output, so starting the deployment never resolves Kit by an adapter's dependency name. The Node handler and standalone listener share that single built application instance.