---
id: 01a19562-da29-716c-baa8-d5d4fbee9bcb
title: An await that a reactive expression continues past is resumed with `save`, and the expression ends its reading with `unsave`
ord: 3
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/compiler/analysis/asynchronous.ts
    symbol: resuming
  - kind: symbol
    ref: packages/vigla/src/compiler/client/script.ts
    symbol: asyncThunk
---
In a template expression or a `$derived` with an `await`, an await whose result the expression still evaluates something after is compiled `(await $.save(x))()`. This covers a left operand, an argument before the last, a member's object, a test, and every await that follows one of those. The thunk's body is then wrapped in `try { return … } finally { $.unsave() }`. The rule is upstream 5.57.3's `pickled_awaits`. An await evaluated last stays plain: nothing of the expression reads after it, so restoring a context there would only open a window for foreign microtasks.

The runtime contract this keeps is [[1a1dd2a2]]'s. The code after a resumed await reads in the batch and view that started the run, and its reads become dependencies of the async run. That reading must end inside the same synchronous segment. `save` ends it at the next suspension and `unsave` at the end of the body; without the `finally`, the last segment's reading would stay open until a later microtask.