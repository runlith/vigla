---
id: 01a185a1-48a5-74a5-9ceb-b972864b44df
title: "Upstream sources in .external are read-only: the behaviour spec and the source of tests, never code to copy"
ord: 11
tags: ["rule"]
---
Frozen at the fork base, shallow, ignored by git:
- `.external/svelte` — `sveltejs/svelte` at tag `svelte@5.57.3`; tests in `packages/svelte/tests`;
- `.external/kit` — `sveltejs/kit` at tag `@sveltejs/kit@3.1.0`; tests in `packages/kit/test`;
- `.external/vite-plugin-svelte` — `sveltejs/vite-plugin-svelte` at tag `@sveltejs/vite-plugin-svelte@7.3.1`.

Before writing a behaviour, read how upstream does it and which edge cases it handles. Upstream tests outside legacy mode are ported as Vigla's compatibility contract. Vigla's code is written anew in TypeScript with its own architecture; whether anything beyond tests is carried over is decided per module in its spec.

Never edit, build, commit in or move them to another ref. A missing one is restored with `python3 ~/.agents/skills/ag-external-refs/scripts/fetch.py <repo url> --name <dir> --ref <tag>`.