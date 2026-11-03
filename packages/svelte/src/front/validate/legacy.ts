import type * as AST from '../ast.ts';
import { CompileError } from 'vigla/compiler';
import { fail, legacy } from '../diagnostics.ts';
import { stopped, type Anchors } from './anchors.ts';

export interface LegacyContext {
	readonly customElement: boolean;
	readonly filename: string | undefined;
	readonly anchors: Anchors;
}

const components = new Set(['Component', 'SvelteComponent', 'SvelteSelf']);

function selfName(filename: string | undefined): { name: string; basename: string } {
	const basename =
		filename === undefined ? 'Self.svelte' : (filename.split(/[/\\]/).pop() as string);
	const stem = basename.replace(/\.svelte$/, '');
	return { name: stem.charAt(0).toUpperCase() + stem.slice(1), basename };
}

function children(node: AST.TemplateNode): (AST.Fragment | null | undefined)[] {
	switch (node.type) {
		case 'IfBlock':
			return [node.consequent, node.alternate];
		case 'EachBlock':
			return [node.body, node.fallback];
		case 'AwaitBlock':
			return [node.pending, node.then, node.catch];
		case 'KeyBlock':
			return [node.fragment];
		case 'SnippetBlock':
			return [node.body];
		default:
			return 'fragment' in node ? [node.fragment] : [];
	}
}

function element(
	node: AST.ElementLike,
	parent: AST.ElementLike | null,
	inSnippet: boolean,
	context: LegacyContext
): void {
	if (node.type === 'SvelteComponent') legacy('svelte_component_deprecated', node);
	if (node.type === 'SvelteSelf')
		legacy('svelte_self_deprecated', node, selfName(context.filename));
	if (node.type === 'SvelteFragment') legacy('svelte_fragment_invalid', node);
	if (node.type === 'SlotElement' && !context.customElement)
		legacy('slot_element_deprecated', node);
	for (const attribute of node.attributes) {
		if (attribute.type === 'LetDirective') legacy('let_directive_invalid', attribute);
		if (attribute.type === 'OnDirective') {
			legacy(
				components.has(node.type)
					? 'component_event_directive_invalid'
					: 'event_directive_deprecated',
				attribute,
				{ name: attribute.name }
			);
		}
		if (attribute.type !== 'Attribute' || attribute.name !== 'slot') continue;
		if (inSnippet) {
			const value = attribute.value;
			if (!Array.isArray(value) || value.length !== 1 || value[0]?.type !== 'Text')
				fail('slot_attribute_invalid', attribute);
		} else if (parent !== null && components.has(parent.type)) {
			legacy('slot_attribute_unsupported', attribute);
		}
	}
}

function fragment(
	nodes: AST.Fragment | null | undefined,
	parent: AST.ElementLike | null,
	context: LegacyContext,
	container: AST.TemplateNode | null = null
): void {
	for (const node of nodes?.nodes ?? []) {
		const isElement = 'attributes' in node && 'name_loc' in node;
		if (isElement) {
			try {
				element(node, parent, container?.type === 'SnippetBlock', context);
			} catch (error) {
				if (!(error instanceof CompileError)) throw error;
				context.anchors.fail(node, error.diagnostic);
				throw stopped;
			}
		}
		const owner = isElement ? node : parent;
		for (const child of children(node)) fragment(child, owner, context, node);
	}
}

export function rejectLegacy(root: AST.Root, context: LegacyContext): void {
	const options = root.options;
	if (options?.runes === false) {
		const at = options.attributes.find(
			(attribute) => attribute.type === 'Attribute' && attribute.name === 'runes'
		);
		legacy('runes_mode_required', at ?? options);
	}
	for (const attribute of options?.attributes ?? []) {
		if (attribute.type !== 'Attribute') continue;
		if (attribute.name === 'accessors') legacy('options_deprecated_accessors', attribute);
		if (attribute.name === 'immutable') legacy('options_deprecated_immutable', attribute);
	}
	const contextAttribute = root.module?.attributes.find(
		(attribute) => attribute.type === 'Attribute' && attribute.name === 'context'
	);
	if (contextAttribute !== undefined) legacy('script_context_deprecated', contextAttribute);
	try {
		fragment(root.fragment, null, {
			...context,
			customElement: context.customElement || options?.customElement !== undefined
		});
	} catch (error) {
		if (error !== stopped) throw error;
	}
}
