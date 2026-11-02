---
id: 01a18775-9009-78c2-8a23-23e1e2d9ed4c
title: The runtime reports warnings and errors by upstream's code and message; the adapter supplies their printed form
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/svelte/src/entries/report.ts
  - kind: file
    ref: packages/vigla/src/runtime/reactivity/errors.ts
  - kind: file
    ref: packages/vigla/src/shared/diagnostics.ts
---
Runtime diagnostics keep upstream's codes and messages — samples and tooling match on them: the hydration runner detects `hydration_mismatch` by the code in a `%c[svelte] <code>` line, and `error`/`runtime_error` samples look for the code in a thrown message. The `[svelte]` prefix and the `https://svelte.dev/e/<code>` line belong to Svelte's world, which the core may not name, so the core hands the reporter installed through `setReporter` a notice: code, message, the message's values and whether the core runs in `DEV`. The reporter decides how much to print, because upstream's policy is per diagnostic: outside `DEV` it prints only the link for client and shared diagnostics, while its server errors always carry their message. The Svelte adapter installs its reporter when `svelte/internal/client` or `svelte/internal/server` loads, which every compiled component imports first. Until something installs one, the core warns `code: message` and throws an error whose message is the code and message on two lines, or only the code outside `DEV`. Where upstream's code or wording names Svelte — `<svelte:boundary>`, `<svelte:element>`, a store — the core reports its own code and words, passing the message's parameters as values. The adapter's reporter projects the code and message to upstream's from those values, never by editing the core's text. The stacks `$inspect(...)` prints follow that boundary too, through `formatFrame`: the adapter projects its public collection names without renaming the shared constructors, and drops the frames of its own entries, which the core does not know. `$inspect.trace` logs its captured errors without that hook. Errors returned by the diagnostic factory retain core identity independently of the reporter's presentation, so hydration can leave a framework failure fatal without parsing the adapter's message or wrapping its error.