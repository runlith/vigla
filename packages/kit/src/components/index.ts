import { compile, type ComponentUnit, type Format, type Generate } from 'vigla/compiler';
import { error, layout } from './fallbacks.ts';
import { root } from './root.ts';

export type ComponentName = 'root' | 'layout' | 'error';

export interface ComponentOptions {
	readonly generate: Generate;
	readonly dev: boolean;
	readonly announcer: string;
	readonly format?: Format;
}

const units: Record<
	ComponentName,
	{ readonly name: string; readonly unit: (options: ComponentOptions) => ComponentUnit }
> = {
	root: { name: 'Root', unit: (options) => root(options.announcer) },
	layout: { name: 'Layout', unit: layout },
	error: { name: 'Error', unit: error }
};

export const componentNames = Object.keys(units) as ComponentName[];

export interface CompiledComponent {
	readonly code: string;
	readonly map: object;
}

export function compileComponent(
	name: ComponentName,
	options: ComponentOptions
): CompiledComponent {
	const { name: component, unit } = units[name];
	const output = compile(unit(options), {
		name: component,
		generate: options.generate,
		dev: options.dev,
		format: options.format
	});
	return output.js;
}
