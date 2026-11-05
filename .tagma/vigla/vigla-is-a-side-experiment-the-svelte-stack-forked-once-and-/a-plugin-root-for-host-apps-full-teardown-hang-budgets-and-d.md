---
id: 01a1ad24-1b9f-7217-bf32-00026b792682
title: "A plugin root for host apps: full teardown, hang budgets and declared globals for interface code written by others"
ord: 10
tags: ["idea"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: relates
    to: 01a0bf97-a4f7-7e8b-bc09-a20c4d2ff254/01a1ad0c-9c6d-75f8-b5b7-b2a7c1891844#Tagma
  - kind: relates
    to: 01a1852f-ba89-7089-9ac3-30ec57917054
  - kind: relates
    to: 01a1852f-ba89-7089-9ac3-30ed66da7f99
  - kind: relates
    to: 01a18776-8e37-7bdc-93a5-7dad4786b347
---
**Question.** Should Vigla give a host application what it needs to run interface code it did not write inside its own document? Three things: a plugin root whose teardown frees everything, a time budget a hung plugin cannot exceed, and globals limited to what the plugin declared.

**Motivation.** Tagma is moving plugin interfaces from iframes into the window ([[c1891844]]), because iframes cost focus, keys, menus, drag and Tagma's own components. Code in the window costs three other things: a hung plugin hangs the window, a leak lives until reload, and the plugin reaches every global. Tagma compiles a native plugin from its source with its own compiler, so whatever Vigla's compiler and runtime add reaches every plugin without its author changing anything.

**What it would be.**
- *Teardown.* A plugin mounts under its own root, which owns every effect, subscription, listener and timer the plugin opens. Disposing the root frees all of it. Rule [[4786b347]] already makes roots, owners and lifetimes public primitives of the core, and a plugin root is one more use of them. Listeners and timers opened through raw globals escape the owner unless the compiler routes them through it.
- *Hang budget.* The compiler inserts budget checks into loops of plugin code and the scheduler counts time per root, so a root over its budget is stopped instead of stalling the document. Only code Vigla compiled is covered.
- *Declared globals.* The compiler resolves `document`, `fetch`, `localStorage` and similar names in plugin code to versions limited to what the plugin declared.

**Boundary.** Rewriting JavaScript at compile time is not a security boundary, because escape hatches remain. These are tools of stability and honesty for code a person chose to install.

**Not the framework's job.** Reactive access to the host's data and the host's components are libraries on top, as layer stays a library ([[57917054]]). They work on today's stack.

**When.** Not before milestone 1, and in Tagma only at stage 2 once Vigla shows a measured win there ([[011655b8]]). The plugin system does not wait for it: Tagma already has to ship native plugins as source and compile them itself, which is the hook these features need.

**Unknown.**
- Whether loop checks cost measurably in hot paths.
- Whether a budget can stop an async root cleanly mid-await.
- Whether hosts other than Tagma want this.
