import type { History } from '@vigla/vite-plugin';

const transformLink =
	'https://github.com/sveltejs/vite-plugin-svelte/blob/main/docs/advanced-usage.md#transform-svelte-files-with-vite-plugins';

const promoted = ['prebundleSvelteLibraries', 'inspector', 'dynamicCompileOptions'];

export const history: History = {
	options(options, log) {
		const experimental = options.experimental as Record<string, unknown> | undefined;
		if (!experimental) return;
		for (const key of promoted) {
			if (!experimental[key]) continue;
			options[key] = experimental[key];
			delete experimental[key];
			log.warn(
				`Option "experimental.${key}" is no longer experimental and has moved to "${key}". Please update your Svelte or Vite config.`
			);
		}
	},
	config(config, log) {
		const using = config.plugins.filter(
			(plugin) => (plugin?.api as { sveltePreprocess?: unknown } | undefined)?.sveltePreprocess
		);
		if (using.length === 0) return;
		log.error.once(
			`The following vite plugins use the removed 'plugin.api.sveltePreprocess' api: ${using.map((plugin) => plugin.name).join(', ')}
				These preprocessors are no longer added to your svelte config and if your application depends on them it breaks.
				Update the plugins or contact their maintainers. See ${transformLink} for more information.
				`.replace(/\t+/g, '\t')
		);
	}
};
