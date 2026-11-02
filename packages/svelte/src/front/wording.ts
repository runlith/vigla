import { warningCodes as core, type Catalog, type Wording } from 'vigla/compiler';

const errors: Catalog = {
	import_svelte_internal_forbidden: [
		"Imports of `svelte/internal/*` are forbidden. It contains private runtime code which is subject to change without notice. If you're importing from `svelte/internal/*` to work around a limitation of Svelte, please open an issue at https://github.com/sveltejs/svelte and explain your use case"
	],
	props_illegal_name: [
		'Declaring or accessing a prop starting with `$$` is illegal (they are reserved for Svelte internals)'
	],
	store_invalid_subscription_module: ['Cannot reference store value outside a `.svelte` file'],
	typescript_invalid_feature: [
		'TypeScript language features like %feature% are not natively supported, and their use is generally discouraged. Outside of `<script>` tags, these features are not supported. For use within `<script>` tags, you will need to use a preprocessor to convert it to JavaScript before it gets passed to the Svelte compiler. If you are using `vitePreprocess`, make sure to specifically enable preprocessing script tags (`vitePreprocess({ script: true })`)'
	],
	const_tag_invalid_placement: [
		'`{@const}` must be the immediate child of `{#snippet}`, `{#if}`, `{:else if}`, `{:else}`, `{#each}`, `{:then}`, `{:catch}`, `<svelte:fragment>`, `<svelte:boundary>` or `<Component>`'
	],
	node_invalid_placement: [
		"%message%. The browser will 'repair' the HTML (by moving, removing, or inserting elements) which breaks Svelte's assumptions about the structure of your components."
	],
	svelte_body_illegal_attribute: [
		'`<svelte:body>` does not support non-event attributes or spread attributes'
	],
	svelte_boundary_invalid_attribute: [
		'Valid attributes on `<svelte:boundary>` are `onerror` and `failed`'
	],
	svelte_boundary_invalid_attribute_value: ['Attribute value must be a non-string expression'],
	svelte_component_invalid_this: ['Invalid component definition — must be an `{expression}`'],
	svelte_component_missing_this: ["`<svelte:component>` must have a 'this' attribute"],
	svelte_element_missing_this: ["`<svelte:element>` must have a 'this' attribute with a value"],
	svelte_fragment_invalid_attribute: [
		'`<svelte:fragment>` can only have a slot attribute and (optionally) a let: directive'
	],
	svelte_fragment_invalid_placement: [
		'`<svelte:fragment>` must be the direct child of a component'
	],
	svelte_head_illegal_attribute: ['`<svelte:head>` cannot have attributes nor directives'],
	svelte_meta_duplicate: ['A component can only have one `<%name%>` element'],
	svelte_meta_invalid_content: ['<%name%> cannot have children'],
	svelte_meta_invalid_placement: ['`<%name%>` tags cannot be inside elements or blocks'],
	svelte_meta_invalid_tag: ['Valid `<svelte:...>` tag names are %list%'],
	svelte_options_deprecated_tag: ['"tag" option is deprecated — use "customElement" instead'],
	svelte_options_invalid_attribute: ['`<svelte:options>` can only receive static attributes'],
	svelte_options_invalid_attribute_value: ['Value must be %list%, if specified'],
	svelte_options_invalid_customelement: [
		'"customElement" must be a string literal defining a valid custom element name or an object of the form { tag?: string; shadow?: "open" | "none" | `ShadowRootInit`; props?: { [key: string]: { attribute?: string; reflect?: boolean; type: .. } } }'
	],
	svelte_options_invalid_customelement_props: [
		'"props" must be a statically analyzable object literal of the form "{ [key: string]: { attribute?: string; reflect?: boolean; type?: "String" | "Boolean" | "Number" | "Array" | "Object" }"'
	],
	svelte_options_invalid_customelement_shadow: [
		'"shadow" must be either "open", "none" or `ShadowRootInit` object.'
	],
	svelte_options_invalid_tagname: ['Tag name must be lowercase and hyphenated'],
	svelte_options_reserved_tagname: ['Tag name is reserved'],
	svelte_options_unknown_attribute: ["`<svelte:options>` unknown attribute '%name%'"],
	svelte_self_invalid_placement: [
		'`<svelte:self>` components can only exist inside `{#if}` blocks, `{#each}` blocks, `{#snippet}` blocks or slots passed to components'
	]
};

const warnings: Catalog = {
	options_removed_hydratable: [
		'The `hydratable` option has been removed. Svelte components are always hydratable now'
	],
	custom_element_props_identifier: [
		"Using a rest element or a non-destructured declaration with `$props()` means that Svelte can't infer what properties to expose when creating a custom element. Consider destructuring all the props or explicitly specifying the `customElement.props` option."
	],
	legacy_component_creation: [
		"Svelte 5 components are no longer classes. Instantiate them using `mount` or `hydrate` (imported from 'svelte') instead."
	],
	attribute_illegal_colon: [
		"Attributes should not contain ':' characters to prevent ambiguity with Svelte directives"
	],
	attribute_quoted: [
		"Quoted attributes on components and custom elements will be stringified in a future version of Svelte. If this isn't what you want, remove the quotes"
	],
	svelte_component_deprecated: [
		'`<svelte:component>` is deprecated in runes mode — components are dynamic by default'
	],
	svelte_element_invalid_this: [
		'`this` should be an `{expression}`. Using a string attribute value will cause an error in future versions of Svelte'
	],
	svelte_self_deprecated: [
		"`<svelte:self>` is deprecated — use self-imports (e.g. `import %name% from './%basename%'`) instead"
	]
};

const after: Readonly<Record<string, string>> = {
	options_removed_hydratable: 'options_removed_enable_sourcemap',
	attribute_illegal_colon: 'attribute_global_event_reference',
	attribute_quoted: 'attribute_invalid_property_name'
};

function ordered(): string[] {
	const codes = [...core];
	for (const code of Object.keys(warnings)) {
		if (codes.includes(code)) continue;
		const anchor = after[code];
		const at = anchor === undefined ? -1 : codes.indexOf(anchor);
		if (at < 0) codes.push(code);
		else codes.splice(at + 1, 0, code);
	}
	return codes;
}

export const wording: Wording = {
	errors,
	warnings,
	name: (host) => `svelte:${host}`
};

export const warningCodes: readonly string[] = ordered();
