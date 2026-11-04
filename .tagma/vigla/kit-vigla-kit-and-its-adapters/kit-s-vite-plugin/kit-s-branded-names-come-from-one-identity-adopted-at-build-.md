---
id: 01a1a410-e35e-7113-83cf-8d5db13f8be3
title: Kit's branded names come from one identity, adopted at build time, defined in Vite builds and adopted by the facade's entries
ord: 17
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a1a3ed-6688-7f72-8a35-40a5ff420c2e
sources:
  - kind: file
    ref: packages/kit/src/shared/identity.ts
  - kind: file
    ref: packages/kit/src/types/identity.ts
  - kind: file
    ref: packages/kit/src/vite/index.ts
  - kind: file
    ref: packages/kit/src/build/worker-entry.ts
  - kind: file
    ref: packages/sveltekit/src/adopt.ts
  - kind: file
    ref: packages/sveltekit/src/identity.ts
  - kind: file
    ref: packages/kit/src/vite/modules.ts
---
Kit's code is the same under its own names and SvelteKit's because every branded name of its visible contract — link attributes, template placeholders, headers and reserved query parameters, content types, output directory, dev assets path, announcer, trusted-types policy, tracer and span names, storage keys, the adapters' shutdown event, diagnostic envelopes and links, product, plugin and command names — is derived from one `Identity` value, which also carries the link options a product has replaced, so Kit warns about another product's retired attributes without knowing them. Internal names (defines, globals, chunks, synthetic ids) are Kit's own under both and are not part of it.

Kit's code runs in three kinds of places, so three channels carry the identity, and they always carry the same value for one app:

- Build-time code — the Vite plugin, config validation, sync, the build — reads the module-level identity that the plugin function `createKit` returns adopts when it is called. A prerender or analysis worker is another process, so its job carries the identity and the worker adopts it.
- Code Vite bundles or transforms for the app reads the `__VIGLA_IDENTITY__` define the plugin sets, the channel that already carries Kit's configuration. In the dev client Vite does not replace defines but sets them as globals from `@vite/client`, which the dev template loads before the app's modules. A dev service worker loads no `@vite/client`, so Kit's plugin makes the worker entry's first import a module that sets that global, ahead of any Kit module the worker evaluates.
- Code loaded without Kit's plugin gets no define: an app's own unit tests, a third-party adapter bundling `@sveltejs/kit/adapter` with its bundler, the upstream unit specs the harness runs. The facade's entries therefore import `adopt.ts` before re-exporting Kit's, so SvelteKit's identity is in place before Kit's modules evaluate — values such as the binary form content type are computed at module evaluation. Without it those consumers see Kit's own names: `applyReroute` would look for `x-vigla-rerouted-url` on a server that sends `x-sveltekit-rerouted-url`, and upstream's matchers would reject `Kit error`. `@vigla/kit` imported directly without the plugin falls back to Kit's own identity.

Adoption is per process: two identities in one process share build-time diagnostics and module-level names with whichever was adopted last. A process builds one app, so this was preferred to threading the identity through every diagnostic emitter.
