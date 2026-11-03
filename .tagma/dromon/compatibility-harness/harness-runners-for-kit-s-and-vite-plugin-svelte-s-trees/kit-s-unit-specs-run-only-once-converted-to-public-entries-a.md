---
id: 01a186ae-4062-7026-8b94-fdeb26c2ff0e
title: Kit's unit specs run only once converted to public entries, and its type tests are one entry per file
ord: 3
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
sources:
  - kind: file
    ref: harness/src/kit/run.ts
  - kind: file
    ref: harness/src/kit/types.ts
---
Kit's and adapter-node's unit specs import the module under test by a relative path into upstream's sources, so their trees copy only the spec files, and a spec runs in the harness only after its import points at a public entry: `exports/index`, `exports/node` and `version`. Every other spec is `covered`, its reason naming the @vigla/kit module whose own tests will assert it. Adapter-bun's specs import `bun:test` and mock its internal sources, so upstream runs them with `bun test`, never vitest, and all are covered by @vigla/adapter-bun. The harness writes a vitest config listing only the files with running entries, because loading a covered spec fails on its missing relative import. The reference runs upstream's `test:unit` scripts unchanged.

The types suite has one entry per test file, which passes when the checker reports no diagnostic in it. The reference runs Kit's own TypeScript 7 `tsc` over upstream's two `test/types` projects, which map `@sveltejs/kit` to its sources. The harness runs tsrs over the same files against the target's published `types/index.d.ts`, which declares the `$app/*` modules. That file is listed by its real path: listed through the package symlink, it is a second file beside the one module resolution reaches, and every declaration in it is duplicated. The no-emit checker permits `.ts` import extensions because Vigla's workspace packages publish their TypeScript sources; the option leaves upstream's declaration-file resolution unchanged.
