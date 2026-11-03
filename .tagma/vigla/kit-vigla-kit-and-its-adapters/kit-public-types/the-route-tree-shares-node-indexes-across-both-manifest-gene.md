---
id: 01a193fe-d106-7b71-a240-5236ea66b85f
title: The route tree shares node indexes across both manifest generators
ord: 2
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/types/internal/routes.ts
---
Sync returns an acyclic project model so the Vite plugin can generate server and client manifests from one ordering. A route's parent is an id; its layout, error and leaf, and each page node's parent, index the same node array. The root layout and error occupy the first two indexes even when they have no component file: that absence selects Kit's generated default components, keeping sync independent of the app's front end.