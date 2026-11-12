---
id: 01a1adeb-5ce0-7482-acf2-16b99fc82ad4
title: A release is one commit that raises versions; its `release/*` tag publishes what the registry lacks, dependencies first
ord: 3
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a1adeb-5c07-70ff-8fdd-134f0e5d48d4
sources:
  - kind: file
    ref: release/src/cli.ts
  - kind: file
    ref: release/src/raise.ts
  - kind: file
    ref: release/src/publish.ts
  - kind: file
    ref: .github/workflows/release.yml
---
A release is one commit that raises versions by the policy of [[0e5d48d4]]. `bun run raise` writes it: it takes the packages whose published files or manifest changed since the last `release/*` tag — or since `--since <commit>` — adds every package pinning one of them, raises each by a patch, or by a minor for a package named with `--minor` because the release breaks its published API, rewrites the `VERSION` literal in the file a manifest names as `release.version`, and runs `bun install` for the lockfile. A change to tests alone raises nothing.

Pushing a `release/<date>` tag on that commit starts the `release` workflow, which runs the whole harness on the tagged commit and, once it is green, `node release/src/cli.ts publish`. The trigger is a tag and not a push to `main`: a later push cancels `main`'s harness run, while a tag's run is never superseded. The tag also marks the commit the registry was published from, which the next `raise` measures from.

`publish` packs every package whose version the registry lacks and passes each tarball through `npm publish --dry-run` before anything goes out. It then publishes one by one in dependency order, so no published version pins a sibling the registry does not hold yet, and ends when the registry answers every new version, which can take minutes. A version the registry already holds is skipped — npm never accepts the same version twice, even after an unpublish — so a run that failed midway is repeated as it is.

The workflow publishes through npm trusted publishing: each package on npmjs.com names `runlith/vigla` and `release.yml`, and the job's `id-token` stands in for a token. The same command run by hand asks for a browser confirmation of the publishing account's second factor, so it runs in a terminal the operator sees.

The harness runs every package from `src`. Of the built files a tarball carries, only their presence is checked, by `pack` refusing a manifest target the staged copy lacks; installing the release from the registry into an empty directory, with the compatibility packages under the upstream aliases, is what proves them, and no workflow does it.
