---
id: 01a1863c-4759-78d7-a467-71a0556aa586
title: Converted samples read bound props back only through keys the props object already has
ord: 10
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a18616-570f-7d0c-9712-d2bf5d8f8564
sources:
  - kind: file
    ref: harness/src/runtime/props.svelte.js
---
The runners pass props as one `$state` object where upstream's legacy runners passed a class component with accessors, and converted samples that read a prop back through `component` depend on two properties of that object.

A component writes a `$bindable` prop back into the object only when the object already has the key: Svelte's `prop()` installs that setter for entry props only if `key in props`. A sample whose test reads a bound value the config never set — `element-ref`'s `bind:this`, `binding-width-height-initialize`'s dimensions — gets the key in its config's `props`, with an `undefined` or default value.

Assigning to the object schedules an update, while a compiled accessor flushes inside its setter. A converted test that assigns a prop and asserts the DOM right after wraps the assignment in `flushSync`; `component.$set({ … })`, which never flushed, becomes plain assignments.
