---
id: 01a187b9-4a81-7c6c-b6d9-a4c0df45d3fd
title: An attachment is rebuilt only when its function changes; a spread's attachments live under the element's owner, not the spread's effect
ord: 6
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/runtime/dom/attachments.ts
---
`attach` tracks only the expression that yields the function: a block effect compares the function by identity and keeps the branch holding the attachment's own effect across reruns, so state the attachment reads reruns that effect (its teardown first) while state that only rebuilds an equal function leaves it alone. A held or forked selection records only the desired function; its commit retires the visible attachment and creates the selected effect under the declaration owner. Discard leaves the visible lifetime untouched, and merged identities carry the selected function into their continuing commit. The attachment's effect is a user effect, so it runs after the element is on screen.

A spread's attribute object is applied inside a template effect, which destroys its children on every rerun. Attachments carried by the object under `createAttachmentKey()` symbols are therefore created under that effect's parent and kept in a map on the spread's state: one is destroyed and recreated only when its symbol's value changes or the symbol leaves the object. Creating them under the template effect would tear every attachment down whenever any spread attribute changed. A component receiving `{@attach}` gets a prop under such a symbol, so it reaches the element that spreads the component's props; a reactive expression is wrapped in a function reading it at call time, so the prop itself stays stable.