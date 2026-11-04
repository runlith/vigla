---
id: 01a1a410-e35e-7113-83cf-8d5db13f8be3
title: "Kit's branded names come from one identity owned by each app: passed to build-time code, defined into bundles, bound into the facade's plugin-free entries"
ord: 17
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a1a3ed-6688-7f72-8a35-40a5ff420c2e
sources:
  - kind: file
    ref: packages/kit/src/build/worker-entry.ts
  - kind: file
    ref: packages/kit/src/entries/internal/identity.ts
  - kind: file
    ref: packages/kit/src/shared/diagnostics.ts
  - kind: file
    ref: packages/kit/src/shared/identity.ts
  - kind: file
    ref: packages/kit/src/types/identity.ts
  - kind: file
    ref: packages/kit/src/vite/index.ts
  - kind: file
    ref: packages/kit/src/vite/modules.ts
  - kind: file
    ref: packages/sveltekit/src/identity.ts
---
Kit's code is the same under its own names and SvelteKit's because every branded name of its visible contract — link attributes, template placeholders, headers and reserved query parameters, content types, output directory, dev assets path, announcer, trusted-types policy, tracer and span names, storage keys, the adapters' shutdown event, diagnostic envelopes and links, product, framework, plugin and command names — is derived from one `Identity` value, which also carries the link options a product has replaced, so Kit warns about another product's retired attributes without knowing them. Internal names (defines, globals, chunks, synthetic ids) are Kit's own under both and are not part of it.

The identity belongs to the app, never to the process: no module holds a mutable identity and nothing adopts one, so two apps of different identities — native and compatibility consumers in one test process, several programmatic builds — keep their own names side by side. Kit's code runs in three kinds of places, and each receives the identity its own way:

- Build-time code — the Vite plugin, config validation, sync, the build, the CLI — receives it from the call that owns the app: `createKit` passes it into the plugins it returns, which carry it on the `Project`, give `createSync` and the config functions a `Diagnostics` bound to it, and put it on the `BuildContext`, from which the `Builder` and each worker job take it; the `svelte-kit` CLI passes its own identity for a config without Kit's plugin. Build-time diagnostics are therefore emitter classes over a `Diagnostics` value rather than free functions.
- Code Vite bundles or transforms for the app reads the `__VIGLA_IDENTITY__` define the plugin sets, as an immutable constant fixed at evaluation, so values such as the binary form content type cannot split between identities. In the dev client Vite does not replace defines but sets them as globals from `@vite/client`, which the dev template loads before the app's modules. A dev service worker loads no `@vite/client`, so Kit's plugin makes the worker entry's first import a module that sets that global, ahead of any Kit module the worker evaluates. Without the define this code falls back to Kit's own identity.
- Public functions usable without Kit's plugin that read the identity — the root entry's `error` and `redirect`, `applyReroute`, `sequence`, `defineParams` — are built by factories over an identity, which `@vigla/kit/internal/identity` and, for the server-only `sequence`, `@vigla/kit/internal/sequence` expose to the facade alone; Kit's entries build them over the define-or-own identity and the facade's entries over SvelteKit's. An app's unit tests or a third-party adapter bundling `@sveltejs/kit/adapter` with its own bundler then see SvelteKit's names by construction: `applyReroute` looks for `x-sveltekit-rerouted-url`, and upstream's matchers see `SvelteKit error`. Entries that read no identity are plain re-exports.
