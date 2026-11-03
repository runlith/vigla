---
id: 01a193fe-630d-7e6f-a952-905ae565ab6b
title: Runtime diagnostics keep code and URL stable while production clients discard message text
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
The compatibility matchers require a plain `Error`, with `SvelteKit error` as its name and code, text and URL on separate lines in development; production diagnostics use the URL alone. Each shared emitter contains its own environment condition so a production browser bundle can remove its text and formatting call. Warnings preserve the same diagnostic envelope through `console.warn` styling, while build-time server analysis can opt into verbose errors.