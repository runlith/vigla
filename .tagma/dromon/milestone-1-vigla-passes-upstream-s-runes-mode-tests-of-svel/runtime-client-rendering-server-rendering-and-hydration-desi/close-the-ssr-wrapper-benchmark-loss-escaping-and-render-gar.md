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