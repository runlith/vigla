---
id: 01a1941f-6f21-7363-a692-dc79f13e53b7
title: Virtual modules retain Kit's importer identity
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/vite/ids.ts
  - kind: file
    ref: packages/kit/src/vite/modules.ts
  - kind: file
    ref: packages/kit/src/vite/index.ts
---
The compiled framework components import the core's internal runtime entries, which must resolve from Kit's own dependencies even when the app installed Kit under an alias. Their virtual identities therefore sit inside Kit's package; imports of Kit's own published internal entries resolve from the app root under its installed name. These identities are resolution anchors rather than files, so dependency optimization externalizes them as servable URLs instead of opening them from disk. The selected front end contributes its format through the Vite plugin API, while the core chooses its defaults when no common format exists.