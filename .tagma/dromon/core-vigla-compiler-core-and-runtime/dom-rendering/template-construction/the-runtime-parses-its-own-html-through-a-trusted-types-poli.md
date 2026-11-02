---
id: 01a19e7c-fbb0-7e55-8491-6e47387c608c
title: The runtime parses its own HTML through a Trusted Types policy the front end names, and never launders `{@html}` values
ord: 3
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a193d2-513d-728f-86f4-01210a0dd463
  - kind: relates
    to: 01a19e56-888b-7dd0-9f94-24c8fa19bad7
sources:
  - kind: file
    ref: packages/vigla/src/runtime/dom/trusted.ts
  - kind: symbol
    ref: packages/vigla/src/runtime/dom/html.ts
    symbol: html
  - kind: symbol
    ref: packages/vigla/src/compiler/client/template.ts
    symbol: policyArgument
---
A page whose CSP says `require-trusted-types-for 'script'` refuses a string at every HTML sink, and a `trusted-types` directive may allow only the policy names it lists, so the runtime parses the HTML it owns through a policy whose name the front end chose: `svelte-trusted-html` for `.svelte` output, as upstream names it and as Kit's CSP lists it, `vigla-html` for native output. The name is the format's `htmlPolicy` and reaches the runtime from compiled code, because a template is a module singleton parsed on its first clone, wherever that happens, and custom elements mount without a format: the compiler passes the name to `fragment()` and `richSelect()` when it is not the native default, and the adapter's `createRawSnippet` passes its format. A policy is created once per name, the first time HTML is parsed under it, only where `trustedTypes` exists; where it does not, or the CSP refuses the name, the string goes to the sink unchanged and the sink decides.

The policy launders only HTML the runtime or the component author wrote: templates, the select-parser probe and raw-snippet output, as upstream's `create_fragment_from_html` does. `{@html}` is the application's value: a `TrustedHTML` it passes reaches `innerHTML` as it is, never stringified, and a plain string meets the CSP like any other assignment, so the policy never turns an arbitrary string into trusted HTML. An empty `{@html}` writes nothing on its first run, and clearing a controlled element removes its children rather than assigning an empty string, since both would be refused under enforcement for no effect. `fragments: 'tree'` builds templates without any sink.