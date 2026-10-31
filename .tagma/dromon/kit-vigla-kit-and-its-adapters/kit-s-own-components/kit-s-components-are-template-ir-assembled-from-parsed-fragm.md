---
id: 01a193f6-94d4-78c0-b2e9-55ff6f19f3fd
title: Kit's components are template IR assembled from parsed fragments of code, compiled per side by the core
ord: 1
tags: ["explanation"]
sources:
  - kind: dir
    ref: packages/kit/src/components
---
Kit renders its root, default layout and default error page in apps that may have no front end, so no `.svelte` source exists to compile. `Source` plays a front end's part for them: it appends each code fragment to one source text, parses it at its own offset with `parseExpression` or `parseProgram`, and marks the callee of each rune call in the unit's map — the port keys runes by node identity, so a fragment is marked as it is parsed. Template nodes get a one-character span of their own, so offsets stay distinct and increasing, while dev locations and source maps point into that synthetic text rather than a file a user wrote.

Client and server code come from one unit compiled twice by the same compiler, which is what keeps the root's hydration markers equal on both sides. The compiled code imports `$app/navigation` and `$app/state` by those names: they resolve through Kit's own module resolution in whichever environment imports the component, which the Vite plugin owns.