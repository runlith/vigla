export interface Messages {
	readonly configChangeDetected: string;
	readonly configChanged: (file: string) => string;
	readonly noClientEnvironment: string;
	readonly configNotFound: (file: string) => string;
	readonly configAbsent: (root: string) => string;
	readonly configsMultiple: (file: string) => string;
	readonly optionsMisplaced: (keys: string) => string;
	readonly optionsAtRoot: (keys: string) => string;
	readonly optionsDuplicate: (keys: string) => string;
	readonly optionsUnknown: (keys: string) => string;
	readonly cssHash: string;
	readonly controlledOptions: (plugin: string, keys: string) => string;
	readonly missingCondition: (conditions: readonly string[]) => string;
}

export const ownMessages: Messages = {
	configChangeDetected:
		'Config file change detected, restart your dev process to apply the changes.',
	configChanged: (file) => `config file changed: restarting vite server. - file: ${file}`,
	noClientEnvironment:
		'No client environment found, not adding watchers for config file and preprocessor dependencies',
	configNotFound: (file) => `failed to find config file ${file}.`,
	configAbsent: (root) => `no config file found at ${root} - using default configuration.`,
	configsMultiple: (file) =>
		`found more than one config file, using ${file}. you should only have one!`,
	optionsMisplaced: (keys) =>
		`Invalid options in config file. Move the following options into 'vitePlugin:{...}': ${keys}`,
	optionsAtRoot: (keys) =>
		`Invalid options in config file under vitePlugin:{...}', move them to the config root : ${keys}`,
	optionsDuplicate: (keys) =>
		`Invalid duplicate options in config file under vitePlugin:{...}', they are defined in root too and must only exist once: ${keys}`,
	optionsUnknown: (keys) =>
		`ignoring unknown plugin options in config file under vitePlugin:{...}: ${keys}`,
	cssHash: 'The custom compilerOptions.cssHash in your config can degrade your DX.',
	controlledOptions: (plugin, keys) =>
		`The following compilerOptions are controlled by ${plugin} and essential to its functionality. User-specified values are ignored. Please remove them from your configuration: ${keys}`,
	missingCondition: (conditions) =>
		`The following packages have a ${conditions.join(' or ')} field in their package.json but no exports condition for it.`
};
