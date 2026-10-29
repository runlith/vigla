---
id: 01a1852f-ba89-7089-9ac3-30e88f3c8b43
title: Preact keeps React compatibility as a goal with a published list of differences
ord: 2
tags: ["research"]
fields:
  {
    "source": {
      "name": "Preact",
      "ref": "https://preactjs.com/guide/v10/differences-to-react, read 2026-10-29"
    }
  }
---
Preact states its compatibility as a goal with a published list of differences, not as identity:
- no synthetic event system — events are native `addEventListener`, named and behaving as in the DOM;
- events do not bubble through `<Portal>`;
- with `preact/compat`, most `onChange` handlers are mapped to `onInput`;
- Preact and `preact/compat` track the current and previous React majors, and core adopts a React feature only when it fits Preact's goals.

The small core and the separate `preact/compat` layer keep the core clean while existing React code still runs through the compat layer.

**Not established.** The page says nothing about concurrent features, Suspense or server components.
