---
id: 01a1adeb-5c07-70ff-8fdd-134f0e5d48d4
title: "Published versions: Vigla's products count their own semver, compatibility packages keep upstream's major.minor with Vigla's own patch"
ord: 2
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a1a11e-0feb-7997-a399-6d4b9ba59820
  - kind: relates
    to: 01a1a3af-44a6-74ab-9e66-720dee890210
sources:
  - kind: file
    ref: packages/vigla/package.json
  - kind: file
    ref: packages/kit/package.json
  - kind: file
    ref: packages/vite-plugin/package.json
  - kind: file
    ref: packages/adapter-node/package.json
  - kind: file
    ref: packages/adapter-bun/package.json
  - kind: file
    ref: packages/adapter-static/package.json
  - kind: file
    ref: packages/svelte/package.json
  - kind: file
    ref: packages/sveltekit/package.json
  - kind: file
    ref: packages/vite-plugin-svelte/package.json
---
Each published package carries one of two numberings.

**Vigla's own products** — `vigla`, `@vigla/kit`, `@vigla/vite-plugin`, `@vigla/adapter-node`, `-bun` and `-static` — count their own semver line from `0.1.0`. While the major is 0, a release that breaks a published API raises the minor (`0.2.0`) and any other release raises the patch, since a `^0.1.0` range admits patches alone.

**The compatibility packages** — `@vigla/svelte`, `@vigla/sveltekit` and `@vigla/vite-plugin-svelte` — are installed as `svelte`, `@sveltejs/kit` and `@sveltejs/vite-plugin-svelte`, where libraries and tools check their version against upstream ranges such as `svelte ^5.46.4`. Their major.minor names the upstream release line whose API and tests the package matches — `5.57`, `3.1`, `7.3`. The patch is Vigla's own count of releases on that line and says nothing about upstream's patches: `@vigla/sveltekit` `3.1.1` is Kit 3.1's API with Vigla's fixes, not upstream's `3.1.1`. Moving to the next upstream line is a release at that major.minor with patch 0. No suffix can mark Vigla's releases instead: `^3` rejects the prerelease `3.1.0-vigla.1`, and npm drops build metadata, so `3.1.0+vigla.1` is the already published `3.1.0`. A peer range naming an upstream patch, such as `^3.1.4`, is met by Vigla's patch number whether or not the release carries that upstream fix.

**A release raises the dependents of what it raises.** `pack` pins every `@vigla/*` dependency to its sibling's exact version, so a published package always brings the sibling it was packed with. A release therefore raises every package whose published files change and, transitively, every package pinning a raised one. A dependent left at its old version installs a second, older copy of the sibling beside the new one: `@vigla/adapter-node` `0.1.0` would bring `@vigla/kit` `0.1.0` next to the `0.1.1` that `@vigla/sveltekit` `3.1.1` pins. A package that neither changed nor pins a raised one keeps its version. Kit's and the facade's `VERSION` literals rise with their manifests, as [[9ba59820]] keeps them.
