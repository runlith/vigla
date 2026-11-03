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
    symbol: fragment
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/template.ts
    symbol: tree
---
The client compiler describes each template once, as a structure of elements, static attributes, text and comments, and emits it in one of two forms chosen by the `fragments` compile option: `html` serializes it into the template literal `fragment()` parses through a `<template>` element's `innerHTML`, while `tree` passes it as nested arrays that `tree()` turns into nodes with `createElement`, `createElementNS`, `createTextNode` and `createComment`. Both build the master once and clone it per instance with the same tail, so hydration, script recreation and navigation do not know which form built a template. `tree` exists for pages whose Content Security Policy requires Trusted Types, where assigning `innerHTML` is refused; it costs more per first build and in output size.

The two forms must build the same DOM, so `tree` reproduces what the HTML parser would do. The compiler writes names as the parser leaves them: lowercased, with the parser's canonical case for SVG tag and attribute names (`linearGradient`, `viewBox`) and MathML's `definitionURL`, and it drops the first newline inside `pre`, `textarea` or `listing`. The runtime creates `svg` and `math` in their namespaces, gives the children of SVG `foreignObject`, `desc` and `title`, of MathML `mi`, `mo`, `mn`, `ms` and `mtext` (but `mglyph` and `malignmark`) and of an `annotation-xml` with an HTML encoding the HTML namespace, puts `xlink:*`, `xml:lang`, `xml:space` and `xmlns` attributes of foreign elements into their namespaces, fills a `template` element's content, and keeps a customized built-in's `is`. A `<!doctype>`, which the parser drops inside a template, is a declaration in the structure: serialized into the HTML as before, never counted as the template's single element, and left out of the tree. Markup the parser would restructure — invalid nesting, an HTML tag that breaks out of SVG or MathML — `tree` builds as written; own sample `tree-foreign-content` pins the foreign-content rules, where upstream's `from_tree` differs. An empty comment is `null` and a comment with data `["// data"]`, upstream's encoding. Adding a node or attribute form to the template structure means extending both serializers; comparing what both forms build across the upstream corpus is the check that they still agree.
