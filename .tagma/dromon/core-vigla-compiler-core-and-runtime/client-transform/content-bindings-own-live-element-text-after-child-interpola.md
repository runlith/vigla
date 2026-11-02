---
id: 01a19550-856a-78f4-9268-0ae067be879b
title: Content bindings own live element text after child interpolation initializes it
ord: 16
tags: ["explanation"]
sources:
  - kind: symbol
    ref: packages/vigla/src/compiler/client/bindings.ts
    symbol: hasContentBinding
  - kind: symbol
    ref: packages/vigla/src/compiler/client/dynamic.ts
    symbol: dynamicCall
  - kind: symbol
    ref: packages/vigla/src/compiler/client/element.ts
    symbol: elementPart
  - kind: symbol
    ref: packages/vigla/src/compiler/client/template.ts
    symbol: textPart
---
An editable binding and a reactive child interpolation cannot both write the same live text: deleting browser-owned text can detach or replace its nodes, and a later interpolation update can duplicate the user's input. Child text therefore seeds bound content once, without a retained text effect or call memoizer, while the binding handles later changes. Dynamic elements attach non-this bindings after rendering their children so an initial content write cannot remove a still-needed render anchor.