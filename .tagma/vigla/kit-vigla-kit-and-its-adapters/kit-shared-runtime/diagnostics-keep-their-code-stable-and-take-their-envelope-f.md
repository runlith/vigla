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

The text inside the envelope is upstream's for every identity: Kit says what `@sveltejs/kit` says, word for word, and only three kinds of words vary. The product's name and documentation come from the identity (`product`, `framework` for the UI runtime a hydration warning names, and `links`, which Kit's own identity leaves empty and then drops with the sentence that introduces them). A front end's file words — the `Svelte` of "Svelte files", the `.svelte` of `+page.svelte` — come from the component extension of the front end the app discovered, which the sync and build emitters read from the configuration, the analysis worker receives with its job and the generated server options carry for the runtime; no Kit file spells a front end's name. Everything else is neutral and identical under both identities.