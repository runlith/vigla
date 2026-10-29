---
id: 01a18781-bc9a-7611-8a73-6099e0b0b484
title: Accessibility warnings are judged over the IR with role data from upstream's aria-query and axobject-query
ord: 1
tags: ["explanation"]
sources:
  - kind: dir
    ref: packages/dromon/src/compiler/analysis/validate/a11y
---
The accessibility checks run over the template IR, not a front end's AST, so `.svelte` and TSX get the same warnings; the template walk calls `checkElement` once per `element` and `dynamic-element`, in pre-order and right after that element's other checks, inside the report's svelte-ignore scope of the element, because upstream emits `check_element` at that point and the suite compares warnings in order.

Role knowledge is not written here: which roles exist, which are abstract, which props a role requires or supports, and which element-and-attribute shapes are interactive come from `aria-query` 5.3.1 and `axobject-query` 4.1.0 — the versions upstream's lockfile holds — derived once at module load into sets and per-tag-name indexes, so a check never scans a role table per element. Moving either package changes which warnings fire; it moves only together with the upstream version the suite is pinned to.

What the IR must keep for these checks to agree with upstream:
- A *static* attribute value is a `text` value of exactly one `text` part (`""` included) or a `boolean` value; any `expression` value, or text with an expression part, is dynamic and skips the value-based checks.
- An event handler is an `attribute` named `on…` with an `expression` value; a string-valued `onclick="…"` is an ordinary attribute.
- Attribute names keep their source case: lookups such as `tabindex` or `href` match exactly, only the `aria-*`/`role` dispatch lowercases.
- `dynamic-element` stands for upstream's `svelte:element`: its name reads `svelte:element` in messages, and an enclosing one makes ancestor checks (`figcaption` in `figure`, `autofocus` in `dialog`, header/footer in `section`/`article`) assume the safe answer.
- Comments stay in the IR for analysis: `has_content` counts a comment as content and `figure`'s child index ignores it, as upstream does.
