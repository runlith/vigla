---
id: 01a19c88-40b5-7fd0-8afd-388a3f9937b6
title: Same-URL goto keeps load reuse unless refresh is explicit
ord: 16
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/client/client.ts
  - kind: file
    ref: packages/kit/src/client/links.ts
  - kind: file
    ref: packages/kit/src/client/load.ts
---
Programmatic navigation to the current URL still uses tracked dependencies: selective invalidation must not refresh unrelated server or universal loads. Full refresh comes from explicit navigation options or the same-URL link handler, which also owns link-specific history behavior; treating URL equality as a full refresh inside the router silently widens a caller's invalidation set.