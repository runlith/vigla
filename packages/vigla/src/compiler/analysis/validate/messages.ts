export const errors: Readonly<Record<string, readonly string[]>> = {
	options_invalid_value: ['Invalid compiler option: %details%'],
	options_removed: ['Invalid compiler option: %details%'],
	options_unrecognised: ['Unrecognised compiler option %keypath%'],
	bindable_invalid_location: ['`$bindable()` can only be used inside a `$props()` declaration'],
	constant_assignment: ['Cannot assign to %thing%'],
	constant_binding: ['Cannot bind to %thing%'],
	declaration_duplicate: ['`%name%` has already been declared'],
	declaration_duplicate_module_import: [
		'Cannot declare a variable with the same name as an import from `<script module>`'
	],
	derived_invalid_export: [
		'Cannot export derived state from a module. To expose the current derived value, export a function returning its value'
	],
	dollar_binding_invalid: ['The $ name is reserved, and cannot be used for variables and imports'],
	dollar_prefix_invalid: ['The $ prefix is reserved, and cannot be used for variables and imports'],
	duplicate_class_field: ['`%name%` has already been declared'],
	each_item_invalid_assignment: [
		'Cannot reassign or bind to each block argument in runes mode. Use the array and index variables instead (e.g. `array[i] = value` instead of `entry = value`, or `bind:value={array[i]}` instead of `bind:value={entry}`)'
	],
	effect_invalid_placement: ['`$effect()` can only be used as an expression statement'],
	experimental_async: [
		'Cannot use `await` in deriveds and template expressions, or at the top level of a component, unless the `experimental.async` compiler option is `true`'
	],
	export_undefined: ['`%name%` is not defined'],
	global_reference_invalid: [
		'`%name%` is an illegal variable name. To reference a global variable called `%name%`, use `globalThis.%name%`'
	],
	host_invalid_placement: ['`$host()` can only be used inside custom element component instances'],
	import_svelte_internal_forbidden: [
		"Imports of `svelte/internal/*` are forbidden. It contains private runtime code which is subject to change without notice. If you're importing from `svelte/internal/*` to work around a limitation of Svelte, please open an issue at https://github.com/sveltejs/svelte and explain your use case"
	],
	inspect_trace_generator: ['`$inspect.trace(...)` cannot be used inside a generator function'],
	inspect_trace_invalid_placement: [
		'`$inspect.trace(...)` must be the first statement of a function body'
	],
	invalid_arguments_usage: [
		'The arguments keyword cannot be used within the template or at the top level of a component'
	],
	legacy_await_invalid: [
		'Cannot use `await` in deriveds and template expressions, or at the top level of a component, unless in runes mode'
	],
	legacy_export_invalid: ['Cannot use `export let` in runes mode — use `$props()` instead'],
	legacy_props_invalid: ['Cannot use `$$props` in runes mode'],
	legacy_reactive_statement_invalid: [
		'`$:` is not allowed in runes mode, use `$derived` or `$effect` instead'
	],
	legacy_rest_props_invalid: ['Cannot use `$$restProps` in runes mode'],
	module_illegal_default_export: ['A component cannot have a default export'],
	props_duplicate: ['Cannot use `%rune%()` more than once'],
	props_id_invalid_placement: [
		'`$props.id()` can only be used at the top level of components as a variable declaration initializer'
	],
	props_illegal_name: [
		'Declaring or accessing a prop starting with `$$` is illegal (they are reserved for Svelte internals)'
	],
	props_invalid_identifier: ['`$props()` can only be used with an object destructuring pattern'],
	props_invalid_pattern: [
		'`$props()` assignment must not contain nested properties or computed keys'
	],
	props_invalid_placement: [
		'`$props()` can only be used at the top level of components as a variable declaration initializer'
	],
	reactive_declaration_cycle: ['Cyclical dependency detected: %cycle%'],
	rune_invalid_arguments: ['`%rune%` cannot be called with arguments'],
	rune_invalid_arguments_length: ['`%rune%` must be called with %args%'],
	rune_invalid_computed_property: ['Cannot access a computed property of a rune'],
	rune_invalid_name: ['`%name%` is not a valid rune'],
	rune_invalid_spread: ['`%rune%` cannot be called with a spread argument'],
	rune_invalid_usage: ['Cannot use `%rune%` rune in non-runes mode'],
	rune_missing_parentheses: ['Cannot use rune without parentheses'],
	rune_removed: ['The `%name%` rune has been removed'],
	rune_renamed: ['`%name%` is now `%replacement%`'],
	runes_mode_invalid_import: ['%name% cannot be used in runes mode'],
	snippet_invalid_export: [
		'An exported snippet can only reference things declared in a `<script module>`, or other exportable snippets'
	],
	snippet_parameter_assignment: ['Cannot reassign or bind to snippet parameter'],
	state_field_duplicate: ['`%name%` has already been declared on this class'],
	state_field_invalid_assignment: ['Cannot assign to a state field before its declaration'],
	state_invalid_export: [
		"Cannot export state from a module if it is reassigned. Either export a function returning the state value or only mutate the state value's properties"
	],
	state_invalid_placement: [
		'`%rune%(...)` can only be used as a variable declaration initializer, a class field declaration, or the first assignment to a class field at the top level of the constructor.'
	],
	store_invalid_scoped_subscription: [
		'Cannot subscribe to stores that are not declared at the top level of the component'
	],
	store_invalid_subscription: ['Cannot reference store value inside `<script module>`'],
	store_invalid_subscription_module: ['Cannot reference store value outside a `.svelte` file'],
	typescript_invalid_feature: [
		'TypeScript language features like %feature% are not natively supported, and their use is generally discouraged. Outside of `<script>` tags, these features are not supported. For use within `<script>` tags, you will need to use a preprocessor to convert it to JavaScript before it gets passed to the Svelte compiler. If you are using `vitePreprocess`, make sure to specifically enable preprocessing script tags (`vitePreprocess({ script: true })`)'
	],
	css_empty_declaration: ['Declaration cannot be empty'],
	css_expected_identifier: ['Expected a valid CSS identifier'],
	css_global_block_invalid_combinator: ['A `:global` selector cannot follow a `%name%` combinator'],
	css_global_block_invalid_declaration: [
		'A top-level `:global {...}` block can only contain rules, not declarations'
	],
	css_global_block_invalid_list: [
		"A `:global` selector cannot be part of a selector list with entries that don't contain `:global`"
	],
	css_global_block_invalid_modifier: ['A `:global` selector cannot modify an existing selector'],
	css_global_block_invalid_modifier_start: [
		'A `:global` selector can only be modified if it is a descendant of other selectors'
	],
	css_global_block_invalid_placement: ['A `:global` selector cannot be inside a pseudoclass'],
	css_global_invalid_placement: [
		'`:global(...)` can be at the start or end of a selector sequence, but not in the middle'
	],
	css_global_invalid_selector: ['`:global(...)` must contain exactly one selector'],
	css_global_invalid_selector_list: [
		'`:global(...)` must not contain type or universal selectors when used in a compound selector'
	],
	css_nesting_selector_invalid_placement: [
		'Nesting selectors can only be used inside a rule or as the first selector inside a lone `:global(...)`'
	],
	css_selector_invalid: ['Invalid selector'],
	css_type_selector_invalid_placement: ['`:global(...)` must not be followed by a type selector'],
	animation_duplicate: ["An element can only have one 'animate' directive"],
	animation_invalid_placement: [
		'An element that uses the `animate:` directive must be the only child of a keyed `{#each ...}` block'
	],
	animation_missing_key: [
		'An element that uses the `animate:` directive must be the only child of a keyed `{#each ...}` block. Did you forget to add a key to your each block?'
	],
	attribute_contenteditable_dynamic: [
		"'contenteditable' attribute cannot be dynamic if element uses two-way binding"
	],
	attribute_contenteditable_missing: [
		"'contenteditable' attribute is required for textContent, innerHTML and innerText two-way bindings"
	],
	attribute_duplicate: ['Attributes need to be unique'],
	attribute_empty_shorthand: ['Attribute shorthand cannot be empty'],
	attribute_invalid_event_handler: [
		'Event attribute must be a JavaScript expression, not a string'
	],
	attribute_invalid_multiple: [
		"'multiple' attribute must be static if select uses two-way binding"
	],
	attribute_invalid_name: ["'%name%' is not a valid attribute name"],
	attribute_invalid_sequence_expression: [
		'Comma-separated expressions are not allowed as attribute/directive values in runes mode, unless wrapped in parentheses'
	],
	attribute_invalid_type: [
		"'type' attribute must be a static text value if input uses two-way binding"
	],
	attribute_unquoted_sequence: [
		'Attribute values containing `{...}` must be enclosed in quote marks, unless the value only contains the expression'
	],
	bind_group_invalid_expression: [
		'`bind:group` can only bind to an Identifier or MemberExpression'
	],
	bind_group_invalid_snippet_parameter: ['Cannot `bind:group` to a snippet parameter'],
	bind_invalid_expression: [
		'Can only bind to an Identifier or MemberExpression or a `{get, set}` pair'
	],
	bind_invalid_name: [
		'`bind:%name%` is not a valid binding',
		'`bind:%name%` is not a valid binding. %explanation%'
	],
	bind_invalid_parens: ['`bind:%name%={get, set}` must not have surrounding parentheses'],
	bind_invalid_target: ['`bind:%name%` can only be used with %elements%'],
	bind_invalid_value: ['Can only bind to state or props'],
	block_duplicate_clause: ['%name% cannot appear more than once within a block'],
	block_invalid_continuation_placement: [
		'{:...} block is invalid at this position (did you forget to close the preceding element or block?)'
	],
	block_invalid_elseif: ["'elseif' should be 'else if'"],
	block_invalid_placement: ['{#%name% ...} block cannot be %location%'],
	block_unclosed: ['Block was left open'],
	block_unexpected_character: [
		'Expected a `%character%` character immediately following the opening bracket'
	],
	block_unexpected_close: ['Unexpected block closing tag'],
	component_invalid_directive: ['This type of directive is not valid on components'],
	const_tag_cycle: ['Cyclical dependency detected: %cycle%'],
	const_tag_invalid_expression: ['{@const ...} must consist of a single variable declaration'],
	const_tag_invalid_placement: [
		'`{@const}` must be the immediate child of `{#snippet}`, `{#if}`, `{:else if}`, `{:else}`, `{#each}`, `{:then}`, `{:catch}`, `<svelte:fragment>`, `<svelte:boundary>` or `<Component>`'
	],
	const_tag_invalid_reference: [
		'The `{@const %name% = ...}` declaration is not available in this snippet'
	],
	debug_tag_invalid_arguments: [
		'{@debug ...} arguments must be identifiers, not arbitrary expressions'
	],
	declaration_tag_invalid_type: ['Declaration tags must be `let` or `const` declarations'],
	declaration_tag_no_legacy_mode: ['Declaration tags cannot be used in legacy mode'],
	directive_invalid_value: [
		'Directive value must be a JavaScript expression enclosed in curly braces'
	],
	directive_missing_name: ['`%type%` name cannot be empty'],
	each_key_without_as: ['An `{#each ...}` block without an `as` clause cannot have a key'],
	element_invalid_closing_tag: ['`</%name%>` attempted to close an element that was not open'],
	element_invalid_closing_tag_autoclosed: [
		'`</%name%>` attempted to close element that was already automatically closed by `<%reason%>` (cannot nest `<%reason%>` inside `<%name%>`)'
	],
	element_unclosed: ['`<%name%>` was left open'],
	event_handler_invalid_component_modifier: [
		"Event modifiers other than 'once' can only be used on DOM elements"
	],
	event_handler_invalid_modifier: ['Valid event modifiers are %list%'],
	event_handler_invalid_modifier_combination: [
		"The '%modifier1%' and '%modifier2%' modifiers cannot be used together"
	],
	expected_attribute_value: ['Expected attribute value'],
	expected_block_type: ["Expected 'if', 'each', 'await', 'key' or 'snippet'"],
	expected_identifier: ['Expected an identifier'],
	expected_pattern: ['Expected identifier or destructure pattern'],
	expected_tag: ["Expected 'html', 'render', 'attach', 'const', or 'debug'"],
	expected_token: ['Expected token %token%'],
	expected_whitespace: ['Expected whitespace'],
	illegal_await_expression: [
		'`use:`, `transition:` and `animate:` directives, attachments and bindings do not support await expressions'
	],
	illegal_element_attribute: [
		'`<%name%>` does not support non-event attributes or spread attributes'
	],
	js_parse_error: ['%message%'],
	let_directive_invalid_placement: ['`let:` directive at invalid position'],
	let_directive_snippet_conflict: [
		'Cannot use `let:` directives on a component that has a `children` snippet. Use snippet parameters instead (e.g. `{#snippet children({ %name% })}`)'
	],
	mixed_event_handler_syntaxes: [
		'Mixing old (on:%name%) and new syntaxes for event handling is not allowed. Use only the on%name% syntax'
	],
	node_invalid_placement: [
		"%message%. The browser will 'repair' the HTML (by moving, removing, or inserting elements) which breaks Svelte's assumptions about the structure of your components."
	],
	render_tag_invalid_call_expression: [
		'Calling a snippet function using apply, bind or call is not allowed'
	],
	render_tag_invalid_expression: ['`{@render ...}` tags can only contain call expressions'],
	render_tag_invalid_spread_argument: ['cannot use spread arguments in `{@render ...}` tags'],
	script_duplicate: [
		'A component can have a single top-level `<script>` element and/or a single top-level `<script module>` element'
	],
	script_invalid_attribute_value: [
		'If the `%name%` attribute is supplied, it must be a boolean attribute'
	],
	script_invalid_context: ['If the context attribute is supplied, its value must be "module"'],
	script_reserved_attribute: ['The `%name%` attribute is reserved and cannot be used'],
	slot_attribute_duplicate: ["Duplicate slot name '%name%' in <%component%>"],
	slot_attribute_invalid: ['slot attribute must be a static value'],
	slot_attribute_invalid_placement: [
		"Element with a slot='...' attribute must be a child of a component or a descendant of a custom element"
	],
	slot_default_duplicate: ['Found default slot content alongside an explicit slot="default"'],
	slot_element_invalid_attribute: [
		'`<slot>` can only receive attributes and (optionally) let directives'
	],
	slot_element_invalid_name: ['slot attribute must be a static value'],
	slot_element_invalid_name_default: [
		'`default` is a reserved word — it cannot be used as a slot name'
	],
	slot_snippet_conflict: [
		'Cannot use `<slot>` syntax and `{@render ...}` tags in the same component. Migrate towards `{@render ...}` tags completely'
	],
	snippet_conflict: [
		'Cannot use explicit children snippet at the same time as implicit children content. Remove either the non-whitespace content or the children snippet block'
	],
	snippet_invalid_rest_parameter: ['Snippets do not support rest parameters; use an array instead'],
	snippet_shadowing_prop: ['This snippet is shadowing the prop `%prop%` with the same name'],
	style_directive_invalid_modifier: ['`style:` directive can only use the `important` modifier'],
	style_duplicate: ['A component can have a single top-level `<style>` element'],
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
	],
	tag_invalid_name: [
		'Expected a valid element or component name. Components must have a valid variable name or dot notation expression'
	],
	tag_invalid_placement: ['{@%name% ...} tag cannot be %location%'],
	textarea_invalid_content: [
		'A `<textarea>` can have either a value attribute or (equivalently) child content, but not both'
	],
	title_illegal_attribute: ['`<title>` cannot have attributes nor directives'],
	title_invalid_content: ['`<title>` can only contain text and {tags}'],
	transition_conflict: ['Cannot use `%type%:` alongside existing `%existing%:` directive'],
	transition_duplicate: ['Cannot use multiple `%type%:` directives on a single element'],
	unexpected_eof: ['Unexpected end of input'],
	unexpected_reserved_word: ["'%word%' is a reserved word in JavaScript and cannot be used here"],
	unterminated_string_constant: ['Unterminated string constant'],
	void_element_invalid_content: ['Void elements cannot have children or closing tags']
};

export const warnings: Readonly<Record<string, readonly string[]>> = {
	a11y_accesskey: ['Avoid using accesskey'],
	a11y_aria_activedescendant_has_tabindex: [
		'An element with an aria-activedescendant attribute should have a tabindex value'
	],
	a11y_aria_attributes: ['`<%name%>` should not have aria-* attributes'],
	a11y_autocomplete_valid: [
		"'%value%' is an invalid value for 'autocomplete' on `<input type=\"%type%\">`"
	],
	a11y_autofocus: ['Avoid using autofocus'],
	a11y_click_events_have_key_events: [
		'Visible, non-interactive element `<%element%>` with a click event must be accompanied by a keyboard event handler. Consider whether an interactive element such as `<button type="button">` or `<a>` might be more appropriate'
	],
	a11y_consider_explicit_label: [
		'Buttons and links should either contain text or have an `aria-label`, `aria-labelledby` or `title` attribute'
	],
	a11y_distracting_elements: ['Avoid `<%name%>` elements'],
	a11y_figcaption_index: ['`<figcaption>` must be first or last child of `<figure>`'],
	a11y_figcaption_parent: ['`<figcaption>` must be an immediate child of `<figure>`'],
	a11y_hidden: ['`<%name%>` element should not be hidden'],
	a11y_img_redundant_alt: ['Screenreaders already announce `<img>` elements as an image'],
	a11y_incorrect_aria_attribute_type: ["The value of '%attribute%' must be a %type%"],
	a11y_incorrect_aria_attribute_type_boolean: [
		"The value of '%attribute%' must be either 'true' or 'false'. It cannot be empty"
	],
	a11y_incorrect_aria_attribute_type_id: [
		"The value of '%attribute%' must be a string that represents a DOM element ID"
	],
	a11y_incorrect_aria_attribute_type_idlist: [
		"The value of '%attribute%' must be a space-separated list of strings that represent DOM element IDs"
	],
	a11y_incorrect_aria_attribute_type_integer: ["The value of '%attribute%' must be an integer"],
	a11y_incorrect_aria_attribute_type_token: [
		"The value of '%attribute%' must be exactly one of %values%"
	],
	a11y_incorrect_aria_attribute_type_tokenlist: [
		"The value of '%attribute%' must be a space-separated list of one or more of %values%"
	],
	a11y_incorrect_aria_attribute_type_tristate: [
		"The value of '%attribute%' must be exactly one of true, false, or mixed"
	],
	a11y_interactive_supports_focus: [
		"Elements with the '%role%' interactive role must have a tabindex value"
	],
	a11y_invalid_attribute: ["'%href_value%' is not a valid %href_attribute% attribute"],
	a11y_label_has_associated_control: ['A form label must be associated with a control'],
	a11y_media_has_caption: ['`<video>` elements must have a `<track kind="captions">`'],
	a11y_misplaced_role: ['`<%name%>` should not have role attribute'],
	a11y_misplaced_scope: ['The scope attribute should only be used with `<th>` elements'],
	a11y_missing_attribute: ['`<%name%>` element should have %article% %sequence% attribute'],
	a11y_missing_content: ['`<%name%>` element should contain text'],
	a11y_mouse_events_have_key_events: [
		"'%event%' event must be accompanied by '%accompanied_by%' event"
	],
	a11y_no_abstract_role: ["Abstract role '%role%' is forbidden"],
	a11y_no_interactive_element_to_noninteractive_role: ["`<%element%>` cannot have role '%role%'"],
	a11y_no_noninteractive_element_interactions: [
		'Non-interactive element `<%element%>` should not be assigned mouse or keyboard event listeners'
	],
	a11y_no_noninteractive_element_to_interactive_role: [
		"Non-interactive element `<%element%>` cannot have interactive role '%role%'"
	],
	a11y_no_noninteractive_tabindex: [
		'noninteractive element cannot have nonnegative tabIndex value'
	],
	a11y_no_redundant_roles: ["Redundant role '%role%'"],
	a11y_no_static_element_interactions: [
		'`<%element%>` with a %handler% handler must have an ARIA role'
	],
	a11y_positive_tabindex: ['Avoid tabindex values above zero'],
	a11y_role_has_required_aria_props: [
		'Elements with the ARIA role "%role%" must have the following attributes defined: %props%'
	],
	a11y_role_supports_aria_props: [
		"The attribute '%attribute%' is not supported by the role '%role%'"
	],
	a11y_role_supports_aria_props_implicit: [
		"The attribute '%attribute%' is not supported by the role '%role%'. This role is implicit on the element `<%name%>`"
	],
	a11y_unknown_aria_attribute: [
		"Unknown aria attribute 'aria-%attribute%'",
		"Unknown aria attribute 'aria-%attribute%'. Did you mean '%suggestion%'?"
	],
	a11y_unknown_role: [
		"Unknown role '%role%'",
		"Unknown role '%role%'. Did you mean '%suggestion%'?"
	],
	bidirectional_control_characters: [
		'A bidirectional control character was detected in your code. These characters can be used to alter the visual direction of your code and could have unintended consequences'
	],
	legacy_code: ['`%code%` is no longer valid — please use `%suggestion%` instead'],
	unknown_code: [
		'`%code%` is not a recognised code',
		'`%code%` is not a recognised code (did you mean `%suggestion%`?)'
	],
	options_deprecated_accessors: [
		'The `accessors` option has been deprecated. It will have no effect in runes mode'
	],
	options_deprecated_immutable: [
		'The `immutable` option has been deprecated. It will have no effect in runes mode'
	],
	options_missing_custom_element: [
		'The `customElement` option is used when generating a custom element. Did you forget the `customElement: true` compile option?'
	],
	options_removed_enable_sourcemap: [
		'The `enableSourcemap` option has been removed. Source maps are always generated now, and tooling can choose to ignore them'
	],
	options_removed_hydratable: [
		'The `hydratable` option has been removed. Svelte components are always hydratable now'
	],
	options_removed_loop_guard_timeout: ['The `loopGuardTimeout` option has been removed'],
	options_renamed_ssr_dom: [
		'`generate: "dom"` and `generate: "ssr"` options have been renamed to "client" and "server" respectively'
	],
	custom_element_props_identifier: [
		"Using a rest element or a non-destructured declaration with `$props()` means that Svelte can't infer what properties to expose when creating a custom element. Consider destructuring all the props or explicitly specifying the `customElement.props` option."
	],
	export_let_unused: [
		"Component has unused export property '%name%'. If it is for external reference only, please consider using `export const %name%`"
	],
	legacy_component_creation: [
		"Svelte 5 components are no longer classes. Instantiate them using `mount` or `hydrate` (imported from 'svelte') instead."
	],
	non_reactive_update: [
		'`%name%` is updated, but is not declared with `$state(...)`. Changing its value will not correctly trigger updates'
	],
	perf_avoid_inline_class: [
		"Avoid 'new class' — instead, declare the class at the top level scope"
	],
	perf_avoid_nested_class: ['Avoid declaring classes below the top level scope'],
	reactive_declaration_invalid_placement: [
		'Reactive declarations only exist at the top level of the instance script'
	],
	reactive_declaration_module_script_dependency: [
		'Reassignments of module-level declarations will not cause reactive statements to update'
	],
	state_referenced_locally: [
		'This reference only captures the initial value of `%name%`. Did you mean to reference it inside a %type% instead?'
	],
	store_rune_conflict: [
		"It looks like you're using the `$%name%` rune, but there is a local binding called `%name%`. Referencing a local variable with a `$` prefix will create a store subscription. Please rename `%name%` to avoid the ambiguity"
	],
	css_unused_selector: ['Unused CSS selector "%name%"'],
	attribute_avoid_is: ['The "is" attribute is not supported cross-browser and should be avoided'],
	attribute_global_event_reference: [
		'You are referencing `globalThis.%name%`. Did you forget to declare a variable with that name?'
	],
	attribute_illegal_colon: [
		"Attributes should not contain ':' characters to prevent ambiguity with Svelte directives"
	],
	attribute_invalid_property_name: [
		"'%wrong%' is not a valid HTML attribute. Did you mean '%right%'?"
	],
	attribute_quoted: [
		"Quoted attributes on components and custom elements will be stringified in a future version of Svelte. If this isn't what you want, remove the quotes"
	],
	bind_invalid_each_rest: [
		"The rest operator (...) will create a new object and binding '%name%' with the original object will not work"
	],
	block_empty: ['Empty block'],
	component_name_lowercase: [
		'`<%name%>` will be treated as an HTML element unless it begins with a capital letter'
	],
	element_implicitly_closed: [
		'This element is implicitly closed by the following `%tag%`, which can cause an unexpected DOM structure. Add an explicit `%closing%` to avoid surprises.'
	],
	element_invalid_self_closing_tag: [
		'Self-closing HTML tags for non-void elements are ambiguous — use `<%name% ...></%name%>` rather than `<%name% ... />`'
	],
	event_directive_deprecated: [
		'Using `on:%name%` to listen to the %name% event is deprecated. Use the event attribute `on%name%` instead'
	],
	node_invalid_placement_ssr: [
		'%message%. When rendering this component on the server, the resulting HTML will be modified by the browser (by moving, removing, or inserting elements), likely resulting in a `hydration_mismatch` warning'
	],
	script_context_deprecated: [
		'`context="module"` is deprecated, use the `module` attribute instead'
	],
	script_unknown_attribute: [
		'Unrecognised attribute — should be one of `generics`, `lang` or `module`. If this exists for a preprocessor, ensure that the preprocessor removes it'
	],
	slot_element_deprecated: [
		'Using `<slot>` to render parent content is deprecated. Use `{@render ...}` tags instead'
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
