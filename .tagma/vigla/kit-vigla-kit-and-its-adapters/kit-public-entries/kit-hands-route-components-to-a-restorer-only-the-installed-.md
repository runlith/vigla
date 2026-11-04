---
id: 01a1a488-b6f8-775f-9423-17805db5fd3b
title: Kit hands route components to a restorer only the installed facade supplies, through `internal/restore`, so Kit reads no component's exported `snapshot`
ord: 3
tags: ["explanation"]
edges:
  - kind: relates
    to: 01a1a3ed-6688-7f72-8a35-40a5ff420c2e
  - kind: relates
    to: 01a1a453-d4cf-7350-bca2-6e533a5a7984
sources:
  - kind: file
    ref: packages/kit/src/entries/internal/restore.ts
  - kind: file
    ref: packages/kit/src/vite/client.ts
  - kind: file
    ref: packages/kit/src/client/client.ts
  - kind: file
    ref: packages/kit/src/client/links.ts
  - kind: file
    ref: packages/sveltekit/src/internal/restore.ts
---
SvelteKit 3.1 still captures and restores the `snapshot` a page or layout component exports, which Kit's own contract replaces with `$app/navigation`'s `snapshot` helper. So that Kit reads no component's `snapshot` and holds none of that mechanism, its client hands the route components to a `Restorer` only when the app supplies one: the generated client app re-exports `restorer` from `<installed name>/internal/restore`, the import [[f13e53b7]] describes, so the package the app installed Kit under decides. Kit's own entry exports no restorer; the facade's builds one per tab from upstream's `capture_snapshot`, `restore_snapshot` and `persist_state`: the `<identity>:snapshot` record in upstream's key and shape, and the `snapshot_export_deprecated` warning once per tab in development.

The entry is the narrowest seam because each other carrier fails one of the constraints. A registration call needs facade code running in the tab's context, which only the facade's wrapper of an app's `hooks.client` file would give it, and many apps have none. A start wrapper misses dev and split builds, which boot from Kit's own `internal/client` file. A `createKit` option is open to every caller of `@vigla/kit/vite`. A module-level registry is process state shared by every app. The identity is data defined into bundles and cannot carry a function. The installed-name import reaches the generated app in dev and in every bundle strategy, and resolves only to Kit itself or to the facade the app installed it under, so app code cannot attach a restorer and Kit's own apps never get one.

Kit calls the restorer where upstream touches component snapshots, which is not where it touches its own records. The restorer captures the page being left by a navigation that is not shallow, a popstate that is not shallow, and a persist. It restores on startup and on a popstate that is not shallow. It prunes onward navigations when a navigation that does not replace pushes an entry, shallow or not. A shallow `pushState`, a hash link or a hashchange never reaches it, though Kit captures scroll and registered snapshots at those points. Calling it from `Restoration.capture` or `Restoration.clear` would capture and prune at those extra points and change what an app restores.
