---
id: 01a1a110-1ad2-7032-9301-a775dbbb75d3
title: Package builds and packing
ord: 25
tags: ["module"]
fields:
  {
    "id": "release",
    "kind": "substrate"
  }
sources:
  - kind: dir
    ref: release
---
Turns each workspace package into what its users install. It owns the build every package's `build` script runs — tsrs emitting `dist` JavaScript, declarations, declaration maps and sourcemaps beside `src`, plus CommonJS bundles a package asks for — and `pack`, which builds the publishable packages, stages each with a publish manifest derived from its workspace manifest and runs `bun pm pack` — and the release itself: `raise` writes the versions of a release commit, `publish` sends the registry the versions it lacks. What a package publishes, how it builds and which targets it exports stay on that package's own manifest; the workspace keeps running from `src`.