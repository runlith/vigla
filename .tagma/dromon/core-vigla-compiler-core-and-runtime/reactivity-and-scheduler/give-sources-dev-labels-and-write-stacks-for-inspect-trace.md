---
id: 01a187ef-87f1-7eba-ae15-b2dd82502fc0
title: Give sources DEV labels and write stacks for `$inspect.trace`
ord: 6
tags: ["task"]
fields:
  {
    "status": "open"
  }
---
`$inspect.trace` (16 runtime-runes entries) prints, for each source a traced reaction read, its label and the stack of the write that last changed it. The core has neither: sources carry no name, and writes keep no stack. Add DEV-only hooks for a label set where a rune is declared and for capturing the stack at write time, read the way upstream's `trace` does (`.external/svelte/packages/svelte/src/internal/client/dev/tracing.js`), and hand the hook names to templates, which compiles `$inspect.trace`.