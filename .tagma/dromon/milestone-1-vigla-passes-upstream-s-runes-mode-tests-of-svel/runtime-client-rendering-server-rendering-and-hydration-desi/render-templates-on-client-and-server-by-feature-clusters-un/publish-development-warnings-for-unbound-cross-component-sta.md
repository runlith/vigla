---
id: 01a19d46-845c-771c-9f5f-3f01280bcf88
title: Publish development warnings for unbound cross-component state mutation
ord: 11
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: discovered-from
    to: 01a193f2-ff55-75b7-98e3-3cbacd2aed6d
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
---
Complete the twelve variants in the ownership-diagnostics cluster of compat-refresh's owner-clusters.json: async-ownership-validation and non-local-mutation-discouraged, inherited-owner-2/3 and with-binding-2/3, each dom/hydrate. Their UI assertions pass but expected unbound-owner warnings are missing. Verify current behavior and frozen compiler/props/proxy provenance before implementing the missing DEV publisher/consumer contract. Preserve production behavior, legitimate bound ownership and unrestricted application-level Core owners; reuse existing diagnostics and ignore metadata, and retain no destroyed tree through diagnostic metadata. Land manual passing ids with the source after focused controls and typechecks.