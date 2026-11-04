---
id: 01a193fe-630d-7e6f-a952-905ae565ab6b
title: Diagnostics keep their code stable and take their envelope from the identity, while production clients discard message text
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/shared/diagnostics.ts
  - kind: file
    ref: packages/kit/src/shared/errors.ts
  - kind: file
    ref: packages/kit/src/shared/warnings.ts
---
The compatibility matchers require a plain `Error` named by the identity's product — `SvelteKit error` under the facade — with code, text and the identity's diagnostic link on separate lines in development; production diagnostics carry the link alone, or the bare code under an identity without links, such as Kit's own. Each shared emitter contains its own environment condition so a production browser bundle can remove its text and formatting call. Warnings keep the same envelope through `console.warn` styling under the identity's `[name]` prefix, while build-time server analysis can opt into verbose errors.