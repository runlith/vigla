---
id: 01a18679-19d9-77b5-9372-29e928467398
title: Upstream Kit and vite-plugin-svelte tests are copied as whole trees whose project conversions the reference run shares
ord: 1
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
  - kind: relates
    to: 01a18616-570f-7d0c-9712-d2bf5d8f8564
sources:
  - kind: file
    ref: harness/src/copy.ts
  - kind: file
    ref: harness/src/trees.ts
---
Kit's test apps and vite-plugin-svelte's e2e projects are not samples a runner iterates: each is a project that upstream's own scripts build and serve, with helpers, configs and local packages beside it. So an upstream-project tree names a directory copied whole into `harness/samples/<project>/<tree>`, and `copy.ts --check` holds every file equal to upstream except those the manifest's `conversions` lists, each with its reason. A listed file must differ from upstream; one listed but absent was removed, as Kit 3.1 refuses a `svelte.config.js`.

Conversions of project files — runes, Kit 3.1's config and `#lib` imports for the plugin's Kit 2-era projects, the `body` read async mode requires — are written into the reference copy too, so upstream's runner and the harness run the same projects and a project's tests stay contract, inside the equality. Conversions of the runner's support files, such as `bun run --silent` for `pnpm`, stay out of the reference. Kit's copied trees mirror upstream's layout in the work tree, so the relative imports between them (`../../utils.js`, `test-utils`) still resolve. The few imports that reach outside every tree — the adapters' sources, Kit's `format.js` — are rewritten in the harness copy to the target's adapter packages and a harness helper. Symlinks are copied as symlinks, because basics serves a symlinked static directory and tests it. Unit-spec trees take only the spec files, so none of upstream's source code enters the repository. A test whose own file is converted is `converted`. That includes an expectation written against an earlier upstream version, such as kit-node's Kit 2.59 resolved config, updated to what the target's version generates. A test that fails in the reference configuration while Vigla keeps its expectation, such as async dev showing a stale remote value after preloading, is a `difference`.
