---
id: 01a19c38-9bdf-760c-a396-61a9e089b5bd
title: Diagnose bindings to nonreactive properties in development
ord: 4
tags: ["task"]
fields:
  {
    "status": "open"
  }
---
Implement the coupled compiler and runtime DEV binding-validation producer for binding-property-static DOM/hydrate: warn for the five plain or raw property bindings while keeping reactive proxies and accessors quiet. Preserve actual value/control semantics, ignore metadata and adapter-owned diagnostic presentation; prove scoped public cases and land exact manual passing rows with source.