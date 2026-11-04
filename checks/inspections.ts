import { defineInspection } from '@runlith/tagma/rules';

export type InternalsParams = {
	readonly patterns: readonly string[];
};

export const internals = defineInspection<InternalsParams>({
	program: 'checks/programs.ts',
	name: 'internals',
	concern: 'imports'
});

export type MentionsParams = {
	readonly packages: readonly string[];
	readonly fix: string;
};

export type LoadsParams = {
	readonly allows: readonly string[];
	readonly fix: string;
};

export const loads = defineInspection<LoadsParams>({
	program: 'checks/programs.ts',
	name: 'loads',
	concern: 'loading'
});

export type BuiltinsParams = {
	readonly globals: readonly string[];
	readonly tests: readonly string[];
	readonly fix: string;
};

export const builtins = defineInspection<BuiltinsParams>({
	program: 'checks/programs.ts',
	name: 'builtins',
	concern: 'loading'
});

export type WordsParams = {
	readonly words: readonly string[];
	readonly tests: readonly string[];
	readonly fix: string;
};

export const words = defineInspection<WordsParams>({
	program: 'checks/programs.ts',
	name: 'words',
	concern: 'code'
});

export type Programs = {
	readonly internals: InternalsParams;
	readonly mentions: MentionsParams;
	readonly loads: LoadsParams;
	readonly builtins: BuiltinsParams;
	readonly words: WordsParams;
};

export const mentions = defineInspection<MentionsParams>({
	program: 'checks/programs.ts',
	name: 'mentions',
	concern: 'imports'
});
