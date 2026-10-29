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

export const mentions = defineInspection<MentionsParams>({
	program: 'checks/programs.ts',
	name: 'mentions',
	concern: 'imports'
});
