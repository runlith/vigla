import type { Component } from 'svelte';
import { render } from 'svelte/server';
import type { BrowserConfig } from '../runtime/config.ts';

export default function serve(
	Main: Component<Record<string, unknown>>,
	config: BrowserConfig
): { head: string; body: string } {
	const { head, body } = render(Main, {
		props: config.props ?? {},
		idPrefix: config.id_prefix
	});
	return { head, body };
}
