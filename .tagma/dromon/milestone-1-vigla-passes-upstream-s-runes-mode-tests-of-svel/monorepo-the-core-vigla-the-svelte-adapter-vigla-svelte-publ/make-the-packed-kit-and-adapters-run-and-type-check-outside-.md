---
id: 01a1a11d-7386-73e6-86f6-6cfe7c6ce28a
title: Make the packed Kit and adapters run and type-check outside the workspace
ord: 6
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1a103-2b70-7861-9b0f-32e38cb481b8",
    "status": "done"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faa07b61535
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
---
Kit's `basics` app on an aliased install of the packed packages failed where the workspace hid it: Kit and the adapters named their own files as `src/*.ts`, the analysis worker died on a named import from `package.json` that Node rejects, emitted declarations dropped the reference to Kit's ambient `$app/*` file, and that file lacked upstream's `vite/client` reference. Resolve own files from the running module, keep `VERSION` a literal guarded by the recorded `version` spec, preserve the ambient references, and reference `vite/client`.