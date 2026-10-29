import { flushSync, hydrate, mount, unmount, type Component } from 'svelte';
import type { BrowserConfig } from '../runtime/config.ts';
import { reactive } from '../runtime/props.svelte.js';
import * as assert from './assert.ts';

export interface Flags {
	hydrate: boolean;
	customElement: boolean;
}

async function waitUntil(fn: () => boolean, ms = 500): Promise<void> {
	const start = Date.now();
	do {
		if (fn()) return;
		await new Promise((resolve) => window.setTimeout(resolve, 1));
	} while (Date.now() <= start + ms);
}

export default async function drive(
	Main: Component<Record<string, unknown>>,
	config: BrowserConfig,
	target: HTMLElement,
	flags: Flags
): Promise<void> {
	let rejection: unknown = false;
	const onRejection = (event: PromiseRejectionEvent): void => {
		rejection = event.reason;
	};
	window.addEventListener('unhandledrejection', onRejection);

	try {
		config.before_test?.();

		const props = reactive({ ...(config.props ?? {}) });
		const options = { target, props, intro: config.intro, recover: false };
		const instance = flags.customElement
			? null
			: flags.hydrate
				? hydrate(Main, options)
				: mount(Main, options);

		flushSync();

		if (config.html) assert.htmlEqual(target.innerHTML, config.html);

		if (config.test) {
			await config.test({
				assert,
				get component() {
					if (instance === null)
						throw new Error('test property `component` is not available in custom element tests');
					return props;
				},
				componentCtor: Main,
				target,
				window,
				waitUntil
			});
			if (instance !== null) void unmount(instance);
			if (rejection) throw rejection;
		} else {
			if (instance !== null) void unmount(instance);
			assert.htmlEqual(target.innerHTML, '');
			if (rejection) throw rejection;
		}

		config.after_test?.();
	} catch (error) {
		if (config.error) assert.equal((error as Error).message, config.error);
		else throw error;
	} finally {
		window.removeEventListener('unhandledrejection', onRejection);
	}
}
