import type { Messages } from '@vigla/vite-plugin';

export const messages: Messages = {
	configChangeDetected:
		'Svelte config change detected, restart your dev process to apply the changes.',
	configChanged: (file) => `svelte config changed: restarting vite server. - file: ${file}`,
	noClientEnvironment:
		'No client environment found, not adding watchers for svelte config and preprocessor dependencies',
	configNotFound: (file) => `failed to find svelte config file ${file}.`,
	configAbsent: (root) => `no Svelte config found at ${root} - using default configuration.`,
	configsMultiple: (file) =>
		`found more than one svelte config file, using ${file}. you should only have one!`,
	optionsMisplaced: (keys) =>
		`Invalid options in svelte config. Move the following options into 'vitePlugin:{...}': ${keys}`,
	optionsAtRoot: (keys) =>
		`Invalid options in svelte config under vitePlugin:{...}', move them to the config root : ${keys}`,
	optionsDuplicate: (keys) =>
		`Invalid duplicate options in svelte config under vitePlugin:{...}', they are defined in root too and must only exist once: ${keys}`,
	optionsUnknown: (keys) =>
		`ignoring unknown plugin options in svelte config under vitePlugin:{...}: ${keys}`,
	cssHash: 'The custom compilerOptions.cssHash in your svelte config can degrade your DX.',
	controlledOptions: (plugin, keys) =>
		`The following Svelte compilerOptions are controlled by ${plugin} and essential to its functionality. User-specified values are ignored. Please remove them from your configuration: ${keys}`,
	missingCondition: () =>
		'The following packages have a svelte field in their package.json but no exports condition for svelte.'
};
