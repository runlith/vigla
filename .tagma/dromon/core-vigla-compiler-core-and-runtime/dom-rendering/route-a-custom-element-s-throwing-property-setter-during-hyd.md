---
id: 01a1a13b-3bda-7bb5-ac46-99089136a698
title: Route a custom element's throwing property setter during hydration to its boundary
ord: 35
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9fa9658ccea4
---
Entry: `svelte/runtime-runes/hydration-custom-element-error-boundary (hydrate)`, contract, unrecorded.

The sample spreads `{ value: 'boom' }` onto `<throwing-element>`, whose `value` setter throws, inside `<svelte:boundary>` with a `failed` snippet. Expected after hydration and `tick()`: `<p>failed: setter error</p><p>after</p>`. Vigla leaves `<throwing-element value="boom"></throwing-element>` in place.

Upstream sets a custom element's spread props as properties (`node[key] = value`) during hydration too, so the setter throws inside the boundary's effect and the boundary renders `failed`. Inference, not traced: Vigla's hydrating spread adopts the server's matching attribute and never assigns the property, or assigns it outside the boundary's error routing.