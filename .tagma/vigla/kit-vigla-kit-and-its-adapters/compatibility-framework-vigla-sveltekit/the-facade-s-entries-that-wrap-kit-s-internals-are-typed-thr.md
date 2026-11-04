---
id: 01a1a75d-c4e2-79ce-b7cc-99621a48250e
title: The facade's entries that wrap Kit's internals are typed through declaration-only modules, as Kit's public entries are
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/sveltekit/package.json
  - kind: dir
    ref: packages/sveltekit/src/types
---
The root, `hooks`, `params` and `adapter` entries of `@vigla/sveltekit` build their identity-reading functions from Kit's internal factories, which import Kit's request scope and through it the whole server runtime. Workspace packages publish TypeScript sources, so an entry typed by its implementation lets an application's checker walk into those sources and judge them under the application's own `App` and generated `RouteId` augmentations, where they do not hold; `$app/types` imports the root entry, so every typed application met it. Each such entry therefore carries a `types` condition on a module under `src/types` that re-exports Kit's typed entry and declares only what the facade adds, the same split Kit's own export map makes. Entries that only re-export a typed Kit entry need none: their types already resolve through Kit's condition.