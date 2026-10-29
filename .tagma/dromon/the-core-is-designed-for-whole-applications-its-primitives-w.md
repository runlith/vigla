---
id: 01a18776-8e37-7bdc-93a5-7dad4786b347
title: "The core is designed for whole applications: its primitives work anywhere, never only inside components"
ord: 20
tags: ["rule"]
---
Roots, owners and their lifetimes, context, scheduling and async work are public and usable in services, detached roots and request or navigation scopes, outside component initialisation, with the guarantees components get. A restriction an upstream test pins — context readable only during component initialisation, for example — stays in `@vigla/svelte`'s API as a projection over the general primitive and never limits the core. Upstream code shows behaviour to match and edge cases to handle, never the design to reproduce. When an application needs internals, a patch or a workaround to do something, the core is missing a primitive: that is a defect of the core, fixed there.