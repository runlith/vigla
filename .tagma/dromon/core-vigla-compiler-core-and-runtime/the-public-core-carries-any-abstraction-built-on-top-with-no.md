---
id: 01a19de0-59b2-7950-bf1d-a0b137f29ce1
title: The public core carries any abstraction built on top, with no internal import
ord: 17
tags: ["spec"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: relates
    to: 01a18776-8e37-7bdc-93a5-7dad4786b347
---
**Outcome.** Any abstraction an application builds on Vigla — a DI container, stacked service layers, request scopes, async resources, stores — is written against the public `vigla` entries alone, on client and server, with no internal import, patch or workaround. A need the public surface cannot meet is a core defect, fixed in the core as a general primitive (rule [[4786b347]]); Svelte-pinned restrictions stay in `@vigla/svelte` as projections.

**Owners.** The core's owner model (`Owner`, `root`, `getOwner`) is the lifetime every abstraction hangs on: effects, deriveds, async work, subscriptions and context belong to an owner and end with it. Changes touch `runtime/reactivity` (owners, sources, effects, abort), `runtime/dom/context.ts`, `runtime/server/context.ts` and the public entries; compiled components keep their upstream-pinned behaviour.

**Scenarios the public surface must carry**, each through public `vigla` only:
1. A service graph of at least ten layers: nested and sibling owners, context read through the live owner chain regardless of when it was set, dependents released before their dependencies, a lifetime abort signal per owner.
2. Memoized derived values outside components, owned by the current owner, on client and server.
3. Failure isolation: a failing effect or derived under an owner reaches the nearest handler on its owner chain; siblings keep updating; unhandled failures keep today's propagation.
4. Async services: work started under an owner counts in `settled()`, is cancelled through the owner's signal on dispose, and re-enters its owner after `await` through `owner.run`. Without a platform async store, plain JavaScript continuations carry no ambient owner and compiled code restores it itself. With one installed through `carryAcrossAwait`, the owner and every `AsyncVariable` survive `await`.
5. Server request scopes: a request owner carries services and context into `render()`, and disposing it ends every render owner, signal and teardown beneath it.
6. External sources and subscribers (`external`, `createSubscriber`) live under service owners and release on dispose.
7. Several independent applications in one realm keep isolated contexts and lifetimes, and neither one's pending work nor its unhandled failure reaches the other's flush or settlement.
8. Background service work started under an owner never holds unrelated writes from reaching the screen; holding a batch is an explicit, separate act.
9. Disposing an owner releases everything created under it — services after their dependents, mounted DOM and its listeners — and no lifecycle registration outside an owner is silently dropped.
10. On the server, a request's ambient owner never reaches another request's continuation, and owned derived values follow their cells.

**Acceptance.**
- A public-contract scenario suite in `packages/vigla` covers 1–7 on the client entry and the server variants of 2, 5 and 7, importing only public `vigla` entries; it is recorded and green.
- No test of that suite and no adapter or Kit binding imports `vigla/internal/*` to achieve these scenarios.
- The recorded runtime, hydration, SSR and own suites stay green after the primitives land.
