---
id: 01a1878a-562a-7dce-b94c-59d358fa69c5
title: Semantic checks over the IR are the core's validation, run before analysis in upstream's walk order
ord: 2
tags: ["explanation"]
sources:
  - kind: dir
    ref: packages/vigla/src/compiler/analysis/validate
---
**The split.** `validate/` judges a unit as the port hands it over — the IR template, the module and instance programs, the resolved `runes` and the `ignores` — so `.svelte` and TSX share one set of checks with upstream's codes and messages. A check whose message names `.svelte`-only syntax (`on:`, `let:`, quoted attributes, braces and parentheses around expressions, `<svelte:*>` rules, legacy constructs, `svelte-ignore` codes) reads source the IR no longer carries and stays in the adapter's front end. a11y runs inside the same walk, once per element and dynamic element, right after that element's own checks, so its warnings interleave with the others in upstream's order.

**Before anything refuses.** `compile` and `compileModule` validate before analysis, and the adapter validates alone for `generate: false`, so a semantic error is never hidden behind an `unsupported` refusal, which only code generation raises.

**Its own scope model.** Validation never imports `analysis/index.ts` or `scope.ts`: that scope serves code generation and refuses what it cannot compile, while diagnostics depend on upstream's exact scope semantics. Function depth decides `state_referenced_locally` and the `$` name checks; porous scopes let `var` pass through blocks; element bodies are transparent while block bodies deepen; every reference keeps the path from its program or template root, which `non_reactive_update` and the store checks read; `$name` references become synthetic `store_sub` bindings, which also stop a `$state(...)` call from counting as a rune. Scopes are built in one pass and references resolved after it, so no check is quadratic in the unit.

**Walk order is warning order.** First scopes are built over the module, the instance and the template, where `declaration_duplicate` throws. Then the store subscription checks run, then the walks over the module, the instance and the template, then the post checks `non_reactive_update` and `export_undefined`. Warnings come out in that order and errors are the first one met. A binding takes its rune kind only when the walk reaches its declarator, as upstream's does, so a read before the declaration is no state read. A front end's own diagnostics arrive in `ValidateOptions.front`: `before` goes after the store checks, and `at` anchors warnings or an error to a unit node. The walk emits or throws them where it visits that node: an element's go after its own checks and before its a11y, merged by position. Entries the walk never reaches go at the end of their walk, ahead of the post checks, because only the walk knows where those begin.

**Nothing Svelte-specific.** Which import specifiers are store modules comes from the caller in `ValidateOptions.stores`. Import restrictions of the Svelte package are the adapter's.
