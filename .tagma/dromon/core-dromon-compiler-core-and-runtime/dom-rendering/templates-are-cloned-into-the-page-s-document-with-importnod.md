---
id: 01a1878d-0a4c-78ad-8e38-8870fd049d9e
title: Templates are cloned into the page's document with `importNode`, in every browser
ord: 3
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/dromon/src/runtime/dom/template.ts
---
A template's master copy is parsed into a `<template>` element's content, which belongs to a separate inert document, while the range markers and text nodes the runtime creates belong to the page's. A `cloneNode` clone stays in the inert document, so every insertion across the two documents adopts the moved subtree node by node, at each nesting level whose parent stands in the other document; Chromium also leaks responsive images through that cross-document assembly (sveltejs/svelte#18834). `fragment()` therefore clones with `document.importNode`, so a clone belongs to the page from the start; an SVG or MathML master unwrapped from its parsing wrapper into a page fragment is cloned the same way.

The bare clone call is slower with `importNode` in Chromium; the shape that counts is the mount. Measured in Chromium 151 on an M2 Max, 1000 rows each cloned from a row template, filled, given a listener, with a nested child clone inserted before a page-document anchor, the row inserted before a page-document text anchor inside a list clone: median 54.8 ms with `cloneNode` and 52.9 ms with `importNode` at 1× CPU, 253 and 243 ms at 4×, ten alternating rounds of five mounts each. The benchmark was a scratch script and is not kept; runlith's Svelte patch (hunk 11) measured the same direction on real stands.