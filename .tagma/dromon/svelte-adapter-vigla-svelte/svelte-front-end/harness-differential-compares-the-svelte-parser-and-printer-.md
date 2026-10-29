---
id: 01a187ae-420b-7b7d-991f-f14c2cd5bd40
title: "`harness:differential` compares the `.svelte` parser and printer with upstream's over its whole test corpus"
ord: 3
tags: ["explanation"]
sources:
  - kind: file
    ref: harness/src/differential.ts
  - kind: dir
    ref: packages/svelte/src/front/parse
---
`bun run harness:differential parse|print|fuzz [--filter <path part>] [--step <n>]` compiles nothing and runs no runner. It loads `svelte/compiler` from `targets/upstream` and from `targets/vigla` through each target's installed package. For every `.svelte` file under `.external/svelte/packages/svelte/tests` it compares the two JSON outputs as text, so key order counts:
- `parse` compares the legacy, modern and modern-loose parses of each file;
- `print` compares `print(parse(…, { modern: true }))`;
- `fuzz` compares the three parses on seeded variants of each file under 3000 characters: truncations, deletions and inserted junk such as `{`, `<!--` or `</div>`. The seed is fixed, so a run is reproducible, and `--step` samples every n-th file.

It exits non-zero on any difference. When upstream throws an uncoded error such as "An impossible situation occurred", the entry is counted as `upstreamThrew` and is not a difference.

It is not part of the passing set, because upstream's AST is pinned by the parser suites; this corpus is wider. It is the acceptance check that lets the `.svelte` parser follow upstream's structure, as spec 9ca8ebb2 records, and the check any restructure of that parser must pass. Measured at commit time: parse 13,827 of 13,827 equal, print 4,609 of 4,609, and fuzz at step 7 35,460 equal with 72 upstream throws.
