---
id: 01a1b93f-3d4c-7d83-bb93-77316e688626
title: "Extension points the compiler knows: insertion points, replaceable components and typed point props"
ord: 11
tags: ["idea"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: relates
    to: 01a1852f-ba89-7089-9ac3-30ec57917054
  - kind: relates
    to: 01a1ad24-1b9f-7217-bf32-00026b792682
---
**Question.** Should Vigla give a host application compile-time support for letting other people's code extend its interface: named insertion points, components replaceable by default, and a point's props typed at the contributor's call site?

**Motivation.** A host whose window renders plugin views ([[d2b5f488]]) extends its interface today through an application-level registry — `@runlith/layer` points: a point is a reactive list drawn by a helper, a component is swappable only where it is referenced through a dynamic binding, and nothing tells at build time which points exist or which have no contributor. Tagma compiles plugin views from source with its own compiler, so whatever Vigla's compiler adds reaches every plugin without its author changing anything.

**What it would be.**
- *Insertion point.* An IR node for a named point, compiled to a typed lookup with one error boundary per contributed item and nothing when empty; the build lists every point an application declares and flags points no contributor fills.
- *Replaceable component.* An owner-marked export compiled to `component(anchor, () => override ?? Default)`: replacement at no call-site cost, the component counterpart of a service fallback.
- *Typed point props.* A contributor's props checked against the point's declared props, through TSX ([[8cd5da81]]) or generated declarations for `.svelte`.

**Boundary.** Which parts of an application may be replaced and which only extended is the host's product decision; Vigla gives the mechanism, never the policy.

**Before a spec.** The host decides which of its parts are replaceable, and an application-level version on the existing registry shows what the compiler would add beyond it.

**Unknown.**
- Whether a compiler-level point gives anything measurable over the registry beyond build-time listing.
- The cost of one boundary per item in long lists.
