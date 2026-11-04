---
id: 01a1a476-9534-7ccf-9e7b-43cc1d2e64bc
title: An adapter's read support is checked from the server chunks that carry the read marker
ord: 7
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/build/features.ts
---
`read` from `$app/server` needs the adapter to supply file access, and the only place that knows a route uses it is the bundle: a route calls it from any module its server nodes or endpoint import. `read` therefore announces itself through a marker call that exists only in code the bundler kept, so an unused `read` leaves no trace; the build's chunk-render step records which server chunk carries each marker and strips the call, and after analysis each route that is not prerendered `true` is walked over the chunk imports from its server nodes and endpoint, asking the adapter's `supports.read` with the route's analysed config. A route whose chunks carry the marker with an adapter that does not support it fails with `adapter_read_unsupported` naming the route and adapter. Hooks are not walked, and the development server does not check: a route using `read` under a non-supporting adapter fails at build, not at its first dev request.