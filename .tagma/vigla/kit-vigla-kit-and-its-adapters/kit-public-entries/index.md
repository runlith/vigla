---
id: 01a193f1-4d9c-7780-903d-88cd7526d608
title: Kit public entries
ord: 3
tags: ["module"]
fields:
  {
    "entries": [
      {
        "at": "index.ts"
      },
      {
        "at": "hooks.ts"
      },
      {
        "at": "env.ts"
      },
      {
        "at": "params.ts"
      },
      {
        "at": "adapter.ts"
      },
      {
        "at": "internal/env.ts"
      },
      {
        "at": "internal/client.ts"
      },
      {
        "at": "app/navigation/client.ts"
      },
      {
        "at": "app/state/client.ts"
      },
      {
        "at": "app/forms/client.ts"
      },
      {
        "at": "app/paths/client.ts"
      },
      {
        "at": "app/env/client.ts"
      },
      {
        "at": "app/service-worker/client.ts"
      },
      {
        "at": "env/dynamic/public/client.ts"
      },
      {
        "at": "app/env/server.ts"
      },
      {
        "at": "app/env/public/server.ts"
      },
      {
        "at": "app/env/private/server.ts"
      },
      {
        "at": "app/forms/server.ts"
      },
      {
        "at": "app/navigation/server.ts"
      },
      {
        "at": "app/paths/server.ts"
      },
      {
        "at": "app/state/server.ts"
      },
      {
        "at": "app/server/server.ts"
      },
      {
        "at": "env/dynamic/public/server.ts"
      },
      {
        "at": "env/dynamic/private/server.ts"
      },
      {
        "at": "internal/server.ts"
      },
      {
        "at": "internal/payload.ts"
      },
      {
        "at": "internal/identity.ts",
        "for": [
          "1b906004"
        ]
      },
      {
        "at": "internal/shallow/",
        "for": [
          "1b906004"
        ]
      },
      {
        "at": "internal/restore.ts",
        "for": [
          "1b906004"
        ]
      }
    ],
    "id": "kit-entries"
  }
edges:
  - kind: imports
    to: 01a193f1-4d97-7589-b3a8-69aa6c365dd0
  - kind: imports
    to: 01a193f1-4d9b-787a-b261-3bc8d5d68827
  - kind: imports
    to: 01a193f7-7562-7aff-a349-f485e6941c8e
  - kind: imports
    to: 01a193f7-7564-7052-966b-707c37e1560f
sources:
  - kind: dir
    ref: packages/kit/src/entries
  - kind: file
    ref: packages/kit/package.json
  - kind: file
    ref: packages/kit/tsconfig.json
  - kind: file
    ref: packages/kit/vitest.config.ts
---
What an app imports from Kit: `@vigla/kit` (`@sveltejs/kit` through the facade) and its `hooks`, `params`, `env` and `adapter` subpaths, and the `$app/*` modules as pairs of client and server files the package's import conditions choose between. Each file projects the client or server runtime under Kit's public names; the behaviour lives in those runtimes. `internal/identity`, `internal/shallow` and `internal/restore` are the facade's alone: the first exposes the factories that build the identity-reading public functions (`error`, `redirect`, `applyReroute`, `sequence`, `defineParams`) over an identity, from which Kit's entries build theirs over the define-or-own identity and the facade's over SvelteKit's; through the second its `pushState`/`replaceState` write shallow history without running navigation callbacks, reporting errors under their own names; the third is the restorer slot the generated client app imports under the installed name, empty in Kit's own entry, which the facade's entry of the same name fills.