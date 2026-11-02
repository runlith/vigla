---
id: 01a19e56-888b-7dd0-9f94-24c8fa19bad7
title: A client template is one structure, emitted as parsed HTML or built by DOM calls, and both forms build the same DOM
ord: 3
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a193c4-711d-777f-86c2-681ad4bdeffe
sources:
  - kind: file
    ref: packages/vigla/src/compiler/client/markup.ts
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/template.ts
    symbol: tree
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/template.ts
    symbol: fragment
---
The client compiler describes each template once, as a structure of elements, static attributes, text and comments, and emits it in one of two forms chosen by the `fragments` compile option: `html` serializes it into the template literal `fragment()` parses through a `<template>` element's `innerHTML`, while `tree` passes it as nested arrays that `tree()` turns into nodes with `createElement`, `createElementNS`, `createTextNode` and `createComment`. Both build the master once and clone it per instance with the same tail, so hydration, script recreation and navigation do not know which form built a template. `tree` exists for pages whose Content Security Policy requires Trusted Types, where assigning `innerHTML` is refused; it costs more per first build and in output size.

The two forms must build the same DOM, so `tree` reproduces what the HTML parser would do: an element named `svg` or `math` switches namespace for its subtree and `foreignObject` switches back to HTML, a `template` element's children go into its content, a customized built-in keeps its `is`, and the first newline inside `pre`, `textarea` or `listing`, which the parser drops, is dropped by the compiler from the tree. An empty comment is `null` and a comment with data `["// data"]`, upstream's encoding. Adding a node or attribute form to the template structure means extending both serializers; comparing what both forms build across the upstream corpus is the check that they still agree.
