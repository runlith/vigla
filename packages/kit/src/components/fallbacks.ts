import type { ComponentUnit } from 'vigla/compiler';
import { element, render, show, Source, text } from './source.ts';

export function layout(): ComponentUnit {
	const source = new Source();
	const instance = source.program('const { children } = $props();');
	return source.unit('kit:layout', instance, [render(source, 'children()')]);
}

export function error(): ComponentUnit {
	const source = new Source();
	const instance = source.program("import { page } from '$app/state';");
	return source.unit('kit:error', instance, [
		element(source, 'h1', [], show(source, 'page.status')),
		text(source, ' '),
		element(source, 'p', [], show(source, 'page.error?.message'))
	]);
}
