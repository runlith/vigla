import type { CompileOptions } from './compiler.ts';
import type { FrontEnd } from './front-end.ts';
import type { IdFilter, IdParser } from './id.ts';
import type { ResolvedOptions } from './options.ts';

export interface PluginAPI {
	options: ResolvedOptions;
	moduleOptions: CompileOptions;
	frontEnds: readonly FrontEnd[];
	filter: IdFilter;
	idParser: IdParser;
}
