---
id: 01a1adeb-5ce0-7482-acf2-16b99fc82ad4
title: A release is packed from one commit and published to npm dependencies first, skipping versions the registry already holds
ord: 3
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a1adeb-5c07-70ff-8fdd-134f0e5d48d4
sources:
  - kind: file
    ref: release/src/cli.ts
---
A release is one commit that raises versions by the policy of [[0e5d48d4]], with the lockfile `bun install` writes. `bun run pack --out <dir>` run on that commit builds every package and stages it with its pins, and each tarball passes `npm publish --dry-run` before anything goes out.

Packages are published one by one in dependency order — `vigla`, `@vigla/vite-plugin`, `@vigla/kit`, `@vigla/svelte`, `@vigla/vite-plugin-svelte`, `@vigla/sveltekit`, then the adapters — so no published version pins a sibling the registry does not hold yet. A version the registry already holds is skipped: npm never accepts the same version twice, even after an unpublish. npm asks for a browser confirmation of the publishing account's second factor, so publishing runs in a terminal the operator sees.

A new version can take minutes before the registry answers it. The release is proven by installing it from the registry into an empty directory, with the compatibility packages under the upstream aliases.
