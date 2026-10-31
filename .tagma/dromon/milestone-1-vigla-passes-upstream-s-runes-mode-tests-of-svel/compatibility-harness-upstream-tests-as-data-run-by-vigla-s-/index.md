---
id: 01a185b6-09f2-796e-90b2-9fab49056597
title: "Compatibility harness: upstream tests as data, run by Vigla's runners and validated on upstream first"
ord: 2
tags: ["spec"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: relates
    to: 01a185b6-09f2-796e-90b2-9fa8019de65b
---
**Samples are data, runners are ours.** Upstream samples and Kit test apps are copied from `.external` at the fork base into the repository, changed only by the conversions the manifest records and by one import rewrite map, kept in the repository: `../../../../src/index-client` and similar paths to `svelte`, `../../../helpers.js` and `animation-helpers.js` to the runners' helper module. Vigla's runners reproduce what upstream's runners assert — the variants, the `mode` and `skip_*` fields, the HTML comparison — through public API.

**What upstream's runner does through internals, and what replaces it:**
- reactive props come from `proxy` (`svelte/internal/client`): the runners build them as a `$state` object in a compiled `.svelte.js` module;
- animation timing overrides `raf.tick`, `raf.now`, `raf.tasks` and `queue_micro_task`: the runners fake `requestAnimationFrame` and an animation clock. Under vitest's jsdom setup `esm-env` resolves `BROWSER` to false, so upstream's own `raf` is a no-op over `Date.now`, and the upstream target's hook points `raf.tick` and `raf.now` at the fakes. `performance.now` stays real everywhere: `async-stale-read-many-sources` asserts a real duration budget, which a faked clock passes whatever the runtime costs. The microtask queue is not faked: a zero-duration fake animation finishes synchronously;
- `globalThis.__svelte.uid = 1` resets the `$props.id()` counter: Vigla numbers ids per mount and per `render()` call, so its target resets nothing;
- runners default `accessors: true` and the hydration runner uses `createClassComponent`: both are legacy; props flow through the `$state` object and hydration through `hydrate()`;
- scheduler, hydration and server-context state are cleared between samples: Vigla holds no state of an unmounted tree once its flush settled ([[9d5e3831]]), so nothing is cleared;
- `runtime-production` mocks `esm-env` to `DEV: false`: the runners select production through export conditions.

**Fresh state per target.** Runners are target-agnostic; each target supplies the hook run between samples. The upstream target's hook does what upstream's runner does through internals — `clear`, `hydrating`, `ssr_context`, `raf.tasks`, the `$props.id()` counter and the `__svelte` hydration data — since only upstream needs it; Vigla's hook is empty, by the scheduler invariant.

**Targets.** One install tree per target, `targets/upstream` and `targets/vigla`, in each of which `svelte`, `@sveltejs/kit` and `@sveltejs/vite-plugin-svelte` resolve to that target — upstream's 5.57.3, 3.1.0 and 7.3.1, or Vigla's workspace packages `@vigla/svelte`, `@vigla/kit` and `@vigla/vite-plugin` under alias, with `vigla` beside them. Runners, Kit apps and vite-plugin e2e projects run inside a target's tree, so bare `svelte` imports in samples, Kit and the plugin resolve to the target.

**Validated on upstream first.** Before any Vigla code, the runners on `targets/upstream` must reproduce the pass set of upstream's own runners run with runes forced and async on. A runner change is valid only when that equality still holds.

**Report and the passing set.** One command runs the whole harness against either target and prints counts per suite, status and result. Against Vigla that run is a progress report: an entry Vigla has never passed fails nothing. The entries Vigla passes are recorded in the repository per suite; the change that first makes an entry pass records it, and a recorded entry that fails fails the run. The recorded set is the repository's test suite on Vigla: one command runs it alone, and one runs a single suite or sample for a change that affects only it.

**Acceptance.**
- Every upstream test in scope has a status in the manifest.
- On `targets/upstream`, Vigla's runners pass exactly the contract entries upstream's own runners pass in the reference configuration.
- No runner imports anything under `svelte/internal`; only the upstream target's hook touches upstream internals.
- On `targets/vigla`, a run fails exactly when a recorded entry fails.

Acceptance still needs the recorded vite-plugin e2e entries re-proved after switching to `@vigla/vite-plugin`; that verification is owned by [[6aa3c486]].
