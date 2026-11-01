---
id: 01a19579-ee9c-7f23-9055-fb47dbce8d17
title: Current-time bindings retire their event and frame subscriptions with the media owner
ord: 4
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/dom/media.ts
  - kind: symbol
    ref: packages/vigla/src/compiler/client/bindings.ts
    symbol: binding
---
Native timeupdate events are too sparse during playback, so current-time bindings also sample animation frames while playing and keep the event listener for paused scrubbing. Both subscriptions belong to the binding's owner, preventing a retained media element or a queued frame from writing back after its branch disappears. Media event callbacks publish outside the current reactive owner; playback-rate writes and listeners wait for insertion because browsers can reset the rate while connecting an element.