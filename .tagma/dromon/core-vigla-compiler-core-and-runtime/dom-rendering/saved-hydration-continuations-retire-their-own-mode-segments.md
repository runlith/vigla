---
id: 01a19411-be13-7467-8202-df2ec6b463ba
title: Saved hydration continuations retire their own mode segments
ord: 17
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/hydration.ts
    symbol: resumeHydration
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/async.ts
    symbol: save
---
Several await continuations can resume before either queued cleanup runs. Restoring a saved previous boolean would let one cleanup restore another continuation's temporary hydration mode, so each continuation owns a removable segment and cleanup restores the newest live segment or the ambient mode when none remains.