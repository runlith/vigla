---
id: 01a187bd-0a1b-7898-a673-536927fbb390
title: An input source map is joined to an output map under the component's basename
ord: 3
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a187b5-42f7-7bb6-a2cc-2cedd9d78ae9
sources:
  - kind: file
    ref: packages/vigla/src/compiler/ir/maps.ts
---
Preprocessors name the file they changed by its basename in `sources`, which is what tools such as svelte-preprocess and Vite emit. The output map names its source relative to `outputFilename` instead. Chaining therefore first renames the output map's one source to the basename, so remapping finds the input map under that name and follows it. It then makes every source relative to the output's own source name again, so the sources other files contributed resolve from the output's directory. If the names did not match, remapping would keep the output map unchanged and the preprocessor's sources would be lost without an error. An input map whose single source is empty refers to the component itself, as Vite treats it. A component's JS and CSS maps go through the same chain. `preprocess` combines the maps of its own steps with the same `combine`.