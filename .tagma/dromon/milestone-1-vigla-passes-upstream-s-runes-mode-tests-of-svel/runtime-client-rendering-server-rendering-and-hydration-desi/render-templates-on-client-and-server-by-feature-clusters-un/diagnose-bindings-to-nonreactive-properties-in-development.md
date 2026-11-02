---
id: 01a19c38-9bdf-760c-a396-61a9e089b5bd
title: Diagnose bindings to nonreactive properties in development
ord: 4
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19c39-11c0-7140-9b1c-8da3de24b8d1",
    "status": "in_work"
  }
---
Implement the coupled compiler and runtime DEV binding-validation producer for binding-property-static DOM/hydrate: warn for the five plain or raw property bindings while keeping reactive proxies and accessors quiet. Preserve actual value/control semantics, ignore metadata and adapter-owned diagnostic presentation; prove scoped public cases and land exact manual passing rows with source.