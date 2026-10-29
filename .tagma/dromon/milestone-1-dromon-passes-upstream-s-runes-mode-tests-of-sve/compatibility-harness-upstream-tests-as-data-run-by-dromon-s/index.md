---
id: 01a185b6-09f2-796e-90b2-9fab49056597
title: "Compatibility harness: upstream tests as data, run by Dromon's runners and validated on upstream first"
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
**Samples are data, runners are ours.** Upstream samples and Kit test apps are copied from `.external` at the fork base into the repository, changed only by the conversions the manifest records and by one import rewrite map, kept in the repository: `../../../../src/index-client` and similar paths to `svelte`, `../../../helpers.js` and `animation-helpers.js` to the runners' helper module. Dromon's runners reproduce what upstream's runners assert — the variants, the `mode` and `skip_*` fields, the HTML comparison — through public API.

**What upstream's runner does through internals, and what replaces it:**
- reactive props come from `proxy` (`svelte/internal/client`): the runners build them as a `$state` object in a compiled `.svelte.js` module;
- animation timing overrides `raf.tick`, `raf.now`, `raf.tasks` and `queue_micro_task`: the runners fake `requestAnimationFrame`, `performance.now` and the microtask queue globally, and the runtime reads them at each call, never captured at load;
- `globalThis.__svelte.uid = 1` resets the `$props.id()` counter: Dromon numbers ids per mount and per `render()` call, so its target resets nothing;
- runners default `accessors: true` and the hydration runner uses `createClassComponent`: both are legacy; props flow through the `$state` object and hydration through `hydrate()`;
- scheduler, hydration and server-context state are cleared between samples: Dromon holds no state of an unmounted tree once its flush settled ([[9d5e3831]]), so nothing is cleared;
- `runtime-production` mocks `esm-env` to `DEV: false`: the runners select production through export conditions.

**Fresh state per target.** Runners are target-agnostic; each target supplies the hook run between samples. The upstream target's hook does what upstream's runner does through internals — `clear`, `hydrating`, `ssr_context`, the `$props.id()` counter — since only upstream needs it; Dromon's hook is empty, by the scheduler invariant.

**Targets.** One install tree per target, `targets/upstream` and `targets/dromon`, in each of which `svelte`, `@sveltejs/kit` and `@sveltejs/vite-plugin-svelte` resolve to that target — upstream's 5.57.3, 3.1.0 and 7.3.1, or Dromon's workspace packages `@dromon/svelte`, `@dromon/kit` and `@dromon/vite-plugin` under alias, with `dromon` beside them. Runners, Kit apps and vite-plugin e2e projects run inside a target's tree, so bare `svelte` imports in samples, Kit and the plugin resolve to the target.

**Validated on upstream first.** Before any Dromon code, the runners on `targets/upstream` must reproduce the pass set of upstream's own runners run with runes forced and async on. A runner change is valid only when that equality still holds.

**Report.** One command runs the whole harness against either target and prints counts per suite and status.

**Acceptance.**
- Every upstream test in scope has a status in the manifest.
- On `targets/upstream`, Dromon's runners pass exactly the contract entries upstream's own runners pass in the reference configuration.
- No runner imports anything under `svelte/internal`; only the upstream target's hook touches upstream internals.
