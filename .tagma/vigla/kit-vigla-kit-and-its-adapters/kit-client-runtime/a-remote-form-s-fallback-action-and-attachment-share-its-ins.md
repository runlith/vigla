---
id: 01a19471-a636-7bd7-8393-f3fbe190152a
title: A remote form's fallback action and attachment share its instance identity
ord: 8
tags: ["explanation"]
sources:
  - kind: file
    ref: packages/kit/src/client/remote/form-element.ts
  - kind: file
    ref: packages/kit/src/client/remote/form.ts
---
The action encodes the remote export and optional form key so a plain browser POST reaches the instance the attachment enhances. That instance survives a pending submission even when an optimistic update removes its element; otherwise a failed submission would write issues where the restored UI cannot read them. Only the method, action and attachment are enumerable, so spreading a form does not put its state or operations onto the DOM element.