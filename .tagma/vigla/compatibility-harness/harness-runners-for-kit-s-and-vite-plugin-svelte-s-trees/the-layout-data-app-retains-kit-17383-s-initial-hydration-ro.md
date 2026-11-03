---
id: 01a19c4c-2f2a-764c-ba52-de297aea2c75
title: "The layout-data app retains Kit #17383's initial-hydration route shape"
ord: 5
tags: ["explanation"]
sources:
  - kind: dir
    ref: harness/samples/own/kit/layout-data
---
The fixture follows [the original reproduction at ce1fa53a3a61b6811a36c5cc36b1046cbaacda1a](https://github.com/Tinggaard/sveltekit3-root-properties-undefined/tree/ce1fa53a3a61b6811a36c5cc36b1046cbaacda1a/src/routes). The template await before the pending boundary and the child effect consuming both derived server-data fields must remain together: the report says removing either hides the failure. Direct `/path` loading and refresh exercise the initial server-data handoff; navigation, HMR and a component-only analogue do not establish this route contract.