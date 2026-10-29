---
id: 01a18775-9009-78c2-8a23-23e1e2d9ed4c
title: The runtime reports warnings and errors by upstream's code and message; the adapter supplies their printed form
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/shared/diagnostics.ts
  - kind: file
    ref: packages/svelte/src/entries/report.ts
---
Runtime diagnostics keep upstream's codes and messages — samples and tooling match on them: the hydration runner detects `hydration_mismatch` by the code in a `%c[svelte] <code>` line, and `error`/`runtime_error` samples look for the code in a thrown message. The `[svelte]` prefix and the `https://svelte.dev/e/<code>` line belong to Svelte's world, which the core may not name, so the core hands `(code, message)` to the reporter installed through `setReporter`, the message `null` outside `DEV` as upstream prints only the link there. The Svelte adapter installs its reporter when `svelte/internal/client` or `svelte/internal/server` loads, which every compiled component imports first; until something installs one, the core prints `code: message`.