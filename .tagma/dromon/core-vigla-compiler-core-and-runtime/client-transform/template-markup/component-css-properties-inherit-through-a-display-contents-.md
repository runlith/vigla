---
id: 01a193c0-f233-747d-bd90-3cfde32019de
title: Component CSS properties inherit through a display-contents wrapper
ord: 5
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vigla/src/compiler/client/component.ts
  - kind: file
    ref: packages/vigla/src/compiler/server/component.ts
---
A component has no element of its own, so CSS custom properties on its invocation belong to a wrapper whose children are the component's output, never to the component's props. HTML uses a display-contents wrapper named by the compile format; SVG uses a group. Client and server preserve that wrapper and its inner anchor even when the component is dynamic or empty, so hydration claims the same structure and changes keep the inherited properties.