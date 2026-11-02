---
id: 01a187cb-043a-7c9c-8057-8594c18ff125
title: A front end is found by the `vigla.frontEnd` field of a package the app depends on
ord: 1
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/vite-plugin/src/compile.ts
  - kind: file
    ref: packages/vite-plugin/src/front-end.ts
  - kind: file
    ref: packages/vite-plugin/src/id.ts
  - kind: file
    ref: packages/vite-plugin/src/index.ts
  - kind: file
    ref: packages/vite-plugin/src/plugins/compile-module.ts
  - kind: file
    ref: packages/vite-plugin/src/plugins/optimizer.ts
---
The plugin imports no compiler by name. It reads the package.json of each dependency and devDependency of the Vite root, and of the workspace root when that differs. A package whose `vigla.frontEnd` field is set is a front end, and the plugin knows it by the name the app installed it under, `svelte` for `@vigla/svelte`. The field names the export holding the front end's compiler (an object with `compile`, `compileModule` and `preprocess`, shaped like `svelte/compiler`), the component extensions and module infixes it claims, the export condition and package field marking libraries that ship its sources, and the stem of its config file. The plugin derives the rest from that package's own `exports`: which specifiers to dedupe, prebundle and keep `noExternal`. An app with no front end is valid, including an endpoints-only framework app: discovery returns an empty list, component and module claims stay empty even with include overrides, and compiler prebundling is not installed.

The declaration is a manifest field rather than an export because the adapter's export keys must equal upstream Svelte's. The compiler is imported by the file path its export resolves to, so the plugin needs no resolution from the app. Framework plugins reach the loaded front ends through the main marker's shared `PluginAPI`; a compiler may supply its runtime `Format` so a framework's generated root can use the app's names without importing its front end. Source remains opaque to the plugin: it neither inserts CSS rules into it nor infers a script language from its tags; each compiler's output is JavaScript. Component and module compilation both retain caller-supplied compiler options, including unknown keys; module compilation starts from the caller's options before component-only CSS and HMR defaults are added, leaving validation to its compiler. User options that name extensions or module infixes replace the front end's own only when a single front end is installed. With several, each keeps its own, and a file claimed only through `include` goes to the first.