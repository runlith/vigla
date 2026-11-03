---
id: 01a1946d-0a7e-7fb3-b631-f6cc9696e9e6
title: Kit's public types derived from route-id unions stay inhabited when the ids are plain strings
ord: 5
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/types/paths.ts
---
Kit's own source compiles against `$app/types` at its fallback, where every route id is `string`, while an application compiles against its generated finite unions. A type that splits the ids with `Exclude` or `Extract` collapses to `never` under the fallback, and Kit's build, which produces those values for every application, then cannot be typed without casts. Such a type therefore answers `string` when the ids are `string` and keeps the precise page/endpoint split only for generated finite unions.