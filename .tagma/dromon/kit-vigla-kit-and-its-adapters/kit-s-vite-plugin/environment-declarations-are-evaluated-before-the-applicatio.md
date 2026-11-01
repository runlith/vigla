---
id: 01a1941f-8ef5-7bac-831e-e91f82f6f909
title: Environment declarations are evaluated before the application graph exists
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/vite/env.ts
  - kind: file
    ref: packages/kit/src/vite/server.ts
  - kind: file
    ref: packages/kit/src/sync/env.ts
---
Discovering explicit variable names and schemas requires evaluating the app's environment declaration before generated environment modules or application hooks can load; importing those modules at that point would be circular. A short-lived runner exposes environment flags and rejects other app imports. Server initialization supplies dynamic values before hooks are imported, while browser modules embed only declared public values. User variable names are export aliases over independent internal bindings, so a valid declaration cannot collide with the generator's own names.