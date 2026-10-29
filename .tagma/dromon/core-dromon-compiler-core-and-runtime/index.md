---
id: 01a1867f-c479-7acf-a8b6-3ff877b9bc12
title: "Core `dromon`: compiler core and runtime"
ord: 17
---
The published package `dromon`: the template IR and its front-end port, analysis, component CSS scoping, client and server code generation, beside the runtime — reactivity and scheduler, DOM rendering, server rendering — and the entries that publish both. Compiler and runtime stay one package so compiled components import the runtime of the version that compiled them. It knows no Svelte: front ends fill its port, and the `.svelte` one lives in the adapter.