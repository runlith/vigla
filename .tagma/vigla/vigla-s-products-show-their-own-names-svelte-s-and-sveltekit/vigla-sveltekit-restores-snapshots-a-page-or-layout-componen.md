---
id: 01a1a479-d59a-774f-87fa-456fa9e71661
title: "@vigla/sveltekit restores snapshots a page or layout component exports as `export const snapshot`"
ord: 6
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1a479-fdad-7e07-86ea-ea5b63ec8e90",
    "status": "in_work"
  }
edges:
  - kind: implements
    to: 01a1a3ed-6688-7f72-8a35-40a5ff420c2e
---
Upstream 3.1 still captures and restores a component's exported `snapshot`, warning `snapshot_export_deprecated` once in dev (`runtime/client/client.js` `capture_snapshot`/`restore_snapshot`); Kit reads only the `snapshot` helper of `$app/navigation`, so an app using the export silently loses restore under the facade. Kit's own contract stays without the export; the facade supplies it through the narrowest seam Kit exposes to it alone.