import type { ComponentUnit } from 'vigla/compiler';
import { identity } from '../shared/identity.ts';
import {
	binding,
	boundary,
	component,
	declare,
	element,
	fragment,
	literal,
	property,
	render,
	show,
	snippet,
	Source,
	when
} from './source.ts';

const announcer =
	'position: absolute; left: 0; top: 0; clip: rect(0 0 0 0); clip-path: inset(50%); overflow: hidden; white-space: nowrap; width: 1px; height: 1px';

const script = `import { afterNavigate } from '$app/navigation';
const { page, components, onerror, tree, form, error } = $props();
let mounted = $state(false);
let navigated = $state(false);
let title = $state('');
afterNavigate(() => {
	if (mounted) {
		navigated = true;
		title = document.title || 'untitled page';
	} else {
		mounted = true;
	}
});`;

export function root(): ComponentUnit {
	const source = new Source();
	const instance = source.program(script);
	const node = (leaf: boolean) =>
		source.ignore(
			component(
				source,
				'Component',
				[
					binding(source, 'this', 'components[depth]'),
					property(source, 'data', 'data'),
					property(source, 'form', 'form'),
					property(source, 'params', 'page.params'),
					...(leaf ? [property(source, 'error', 'error')] : [])
				],
				...(leaf ? [] : [render(source, 'node(n.child, depth + 1)')])
			),
			['binding_property_non_reactive']
		);
	const nested = snippet(
		source,
		'node',
		'n, depth',
		declare(source, 'const Component = $derived(n.component)'),
		declare(source, 'const Error = $derived(n.error)'),
		declare(source, 'const data = $derived(n.data)'),
		snippet(
			source,
			'failed',
			'error',
			component(source, 'Error', [property(source, 'error', 'error')])
		),
		boundary(
			source,
			[
				property(source, 'failed', 'Error ? failed : undefined'),
				property(source, 'onerror', 'Error ? onerror : undefined')
			],
			when(source, 'n.child', fragment(node(false)), fragment(node(true)))
		)
	);
	const region = when(
		source,
		'mounted',
		fragment(
			element(
				source,
				'div',
				[
					literal(source, 'id', identity.announcer),
					literal(source, 'aria-live', 'assertive'),
					literal(source, 'aria-atomic', 'true'),
					literal(source, 'style', announcer)
				],
				when(source, 'navigated', fragment(show(source, 'title')), null)
			)
		),
		null
	);
	return source.unit('kit:root', instance, [nested, render(source, 'node(tree, 0)'), region]);
}
