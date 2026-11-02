---
id: 01a1945a-6dcb-7f88-ba1f-c9b4d274a460
title: "Remote functions: Kit 3.1's wire and behaviour, query lifetime by reader, server values through the core's hydration store"
ord: 2
tags: ["spec"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
---
**Outcome.** `query`, `query.batch`, `query.live`, `command`, `form`, `prerender` and `requested` from `$app/server` behave as Kit 3.1's, always enabled. Calling them from the client, from server `load`s, hooks and components, form submission with and without JavaScript, single-flight refreshes and prerendered remote results all work. Upstream's `.external/kit` sources are the behaviour spec, and its `async` and `options-2` apps' remote entries are the acceptance tests.

**Owners.**
- `kit-shared` (`shared/remote.ts`, `shared/form-data.ts`): the remote key (`<hash>/<name>` plus the encoded argument), argument encoding (devalue with the app's `transport`, base64url), and the binary form codec. The server, the client and the build all read these.
- `kit-server` (`server/remote/`): the server side of each kind, exported through `$app/server`'s server file. Each function carries its internals: kind, id, name, validation and implementation. The call handler answers `RemoteCall`: `GET` for query and prerender, `POST` for command, form and batch, and an event stream for live queries. It is reached through the `ServerOptions.remote` port, which the generated options fill only when the app has remote modules. The handler also covers the page-action path a non-enhanced remote form posts to, a per-request query cache on the `RequestStore`, refreshes riding a command's or form's response, Standard Schema validation and `'unchecked'`, validation failures reported through `handleError` with `kind: 'validation'` as Kit 3.1 does, and redirects.
- `kit-client` (`client/remote/`): client factories for every kind, exported from `<kit>/internal/client` for the generated stubs. It keeps one cache per tab, held by the tab owner. It covers:
  - `refresh`, `set`, `withOverride` and optimistic updates;
  - batching per microtask;
  - live queries over the stream, with reconnection;
  - a command or form applying the refreshes its response carries;
  - forms with `fields`, issues, `enhance`, `for(id)` instances and `preflight`;
  - prerendered results.
- `kit-vite` (`vite/remote.ts`): the transform of `*.remote.*` modules.
  - On the server environment it appends a registration through `<kit>/internal/server` that gives every export its id `<hash>/<name>`, where `<hash>` hashes the file's path from the root.
  - On the client environment it replaces the module with stubs, `export const name = remote.<kind>('<hash>/<name>')`. The kinds come from the server module through the app's runner in dev and from the server build's analysis in build.
  - Each remote file becomes its own server chunk in build.
  - The dependency scan externalizes remote modules.
- `kit-build`: analysis of remote exports, and prerendering of `prerender` functions — their `inputs` and the calls the crawl meets — into `_app/remote/` outputs.

**Decisions of Vigla's own.**
1. *Lifetime by reader.* A `query(arg)` cache entry is held while some reaction under an owner (a component, an effect, a detached root, a request or the tab) reads it, and released once no run reads it any more — with the same microtask-deferred release as the core's `createSubscriber`, so a rerun that reads the same entry again keeps it, and an effect whose arguments change releases the entry it no longer reads. A root never reruns, so a read in a root holds the entry until the root is disposed. Read outside any owner, it is a one-shot read that resolves from the cache or a fetch and holds nothing. Upstream ties instances to effect tracking inside components and defers eviction a `tick()`; here the same reader rule holds in services and detached roots (4786b347).
2. *Server-rendered values reach the client through the core's hydration store, read with `hydrated`.* The store is opened on the request owner and keyed by the remote cache key. `hydrated` is the core's optional read, so a key the server never resolved means a fetch, never the `hydratable_missing_but_required` failure. The tab owner reads it while the first document hydrates, so a query the server resolved — in a `load`, a hook or the render — is used without refetching. There is no separate `__sveltekit_*.data` channel.
3. *The wire is upstream's, byte for byte.* That covers URLs under `/<app_path>/remote/`, the `payload` search parameter, headers, the JSON result shapes, SSE framing and the binary form content type. Tests, proxies and caches observe it.
4. *No flag.* `experimental.remoteFunctions` is not required (658ccea4); the build-errors entry asserting the flag is a recorded difference.

**Acceptance.**
- The remote entries of the `async` and `options-2` apps pass in dev and build on `targets/vigla/kit`; first-attempt passing ids are added manually to the shared passing set and land with the change that makes them pass.
- Kit's unit and type entries for remote functions and form data pass.
- A test of Vigla's own holds a query from a detached root: the entry survives the unmount of a component that also read it and is released when the root is disposed. A second test shows a query resolved in a server `load` hydrating without a request.
