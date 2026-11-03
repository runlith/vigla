---
id: 01a19488-29f8-7718-a284-2c7a763f55a8
title: Inlined styles resolve asset URLs for the document that renders them
ord: 6
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/build/manifest.ts
  - kind: file
    ref: packages/kit/src/types/internal/server.ts
  - kind: file
    ref: packages/kit/src/vite/styles.ts
---
Moving CSS from its own file into a document changes the base of relative URLs, and nested documents can have different asset prefixes. Inlined bundle CSS therefore carries a Web-only renderer over the document's asset prefix, just like node-level inlined styles. Built assets and static-directory files both resolve under that prefix: a deployment with `paths.assets` serves static files from it, not from the application base. The build keeps the renderer together with its source expression so manifests emit the function directly; server rendering supplies the current document paths before CSP hashing.