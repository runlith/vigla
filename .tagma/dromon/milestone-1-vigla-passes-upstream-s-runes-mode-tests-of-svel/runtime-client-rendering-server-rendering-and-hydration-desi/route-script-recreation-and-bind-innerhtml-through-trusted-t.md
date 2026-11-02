---
id: 01a19e81-523f-74c2-9030-c98c7384d1a3
title: Route script recreation and bind:innerHTML through Trusted Types
ord: 7
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: implements
    to: 01a185b6-09f2-796e-90b2-9faeec26636a
---
Templates, raw snippets and the rich-select probe pass HTML through the front end's Trusted Types policy (e1cc6fec09), but two sinks still receive plain strings under `require-trusted-types-for 'script'`: a template `<script>`'s recreation writes `textContent` and `src` (TrustedScript and TrustedScriptURL sinks), and `bind:innerHTML` stringifies its value. Upstream has the same gaps. Send each through the same lazily created policy, keeping authored trusted values unchanged, and prove both under an enforcing CSP.