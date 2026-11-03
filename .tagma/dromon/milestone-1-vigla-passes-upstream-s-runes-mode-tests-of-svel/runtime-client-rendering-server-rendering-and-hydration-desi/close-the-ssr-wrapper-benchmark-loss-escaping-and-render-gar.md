---
id: 01a19ec1-5a9b-71fc-864f-eb07926d5808
title: "Close the SSR wrapper benchmark loss: escaping and render garbage surviving scavenges"
ord: 8
tags: ["task"]
fields:
  {
    "holder": "tagma:01a19e32-fb25-7109-9e5d-e26d8c51fa54",
    "status": "in_work"
  }
edges:
  - kind: discovered-from
    to: 01a19e94-3fb8-7d5b-a72d-3163908a7579
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
sources:
  - kind: file
    ref: packages/vigla/src/shared/escape.ts
---
`ssr/wrapper_bench` (upstream's wrapper component, 100 `render(App).body` per timed iteration) measures Vigla/upstream 89.28/68.28 ms in five alternating runs (ratio 1.31), not the 2.01 of the first noisy single run. Both targets generate near-identical server code and byte-identical bodies, so the gap is the runtime's.

Two causes, measured on 2026-11-03:
- **Escaping.** `escapeAttribute` and `escapeContent` (`shared/escape.ts`) call `String.replace` with a callback on every value, including the common value with nothing to escape. Over one iteration's 240k style values that costs 12.1 ms against 5.2 ms for a test-first path that returns the input unchanged.
- **GC.** Inside the timed loop Vigla spends 12.7 ms in GC per 100 renders against about 1 ms for upstream, with similar allocation volume (1.34 GB against 1.47 GB sampled across the run). `--trace-gc` shows about 8.5 MB promoted per scavenge, so the heap after each scavenge climbs from 27 to 62 MB until a mark-compact, while upstream's stays at 14 MB. Nothing is retained across renders: a heap snapshot after 50 synchronous renders holds no `Output`, and 2000 renders leave the heap at its starting size. So render objects are still reachable at each scavenge and become garbage only later. The producer is not identified yet. It lies on the render's owner and context path (`runtime/server/context.ts`, `runtime/reactivity/owners.ts`), which another session is rewriting.

Fix escaping in `shared/escape.ts`; find and fix the promotion at its producer once that rewrite lands; prove each with a back-to-back single-benchmark ratio.

**Escaping, measured.** With a test-first path, five alternating runs per target at load average 5, taken back to back, give Vigla/upstream 88.36/68.38 ms (ratio 1.29) before and 81.33/68.17 ms (1.19) after. Excluding GC, the timed loop is then level with upstream: about 67 against 66 ms.

**Retention, narrowed but not located.** With two explicit minor GCs after every k renders, upstream holds only the latest render: its retained bytes per render fall as 1/k (0.51, 0.26, 0.13, 0.06 MB). Vigla keeps every render since the last major GC alive through scavenges: about 0.53 MB per render for every k, all freed by a major GC. Ruled out: allocation-site pretenuring (`--no-allocation-site-pretenuring` changes nothing), young-generation size, incremental and concurrent marking, the type stripper loaded in-process, flat body strings (both bodies are cons strings), and microtask-deferred release (synchronous renders finish in `render()`). A heap snapshot holding three renders' root outputs finds no strong or weak path from one render's output to another's, and no later render writes into an earlier output. So the link runs through an object outside the output graph, such as a weakly keyed owner, store or layer record whose key reached old space. The size of the effect follows the core-perf owner rewrite in flight: old-space growth over 48 renders fell from 25 MB to 4–8 MB between its batches when the compiler isn't loaded, and stays at 25 MB when it is.