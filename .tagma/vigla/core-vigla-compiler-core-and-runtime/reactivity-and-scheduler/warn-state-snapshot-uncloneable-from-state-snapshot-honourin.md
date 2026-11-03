---
id: 01a1a13b-3db9-7630-af03-159f45d79a75
title: Warn state_snapshot_uncloneable from $state.snapshot, honouring svelte-ignore
ord: 56
tags: ["task"]
fields:
  {
    "holder": "tagma:01a1a140-bed8-7b7b-98cd-f482092a5c0d",
    "status": "done"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
---
Entries of `svelte/units`, converted, unrecorded: `internal/shared/clone.test.ts > uncloneable value`, `> uncloneable properties`, `> many uncloneable properties`. Each expects one DEV warning; Vigla's `snapshot` in `packages/vigla/src/runtime/reactivity/proxy.ts` returns uncloneables silently.

Upstream (`.external/svelte/packages/svelte/src/internal/shared/clone.js`): in DEV, `clone` collects the path of every value `structuredClone` refuses (`[i]`, `.key`, `.toJSON()`); one path `''` warns "Value cannot be cloned with `$state.snapshot` — the original value was returned"; several list `- <value><path>` lines, the first 10, or 7 and `- ...and N more` past 10.

Three parts, found by a reverted attempt:
- the core's `snapshot` warns through `warn('state_snapshot_uncloneable', …)` of `shared/diagnostics.ts`; `$inspect` (`dom/inspect.ts`) and `$inspect.trace` (`reactivity/trace.ts`) take a silent copy, as upstream's `snapshot(value, true)`;
- the client and server code generators emit that silent copy for a `$state.snapshot` call covered by `svelte-ignore state_snapshot_uncloneable`, in script and template alike (upstream passes `is_ignored(node, …)` as the skip flag); `compiler/client/loss.ts` shows the span-based ignore lookup;
- recorded `runtime-runes/state-snapshot-uncloneable-ignored (dom)` pins the ignore and turns red without the second part.