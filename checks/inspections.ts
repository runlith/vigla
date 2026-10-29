import { defineInspection } from '@runlith/tagma/rules';

export type InternalsParams = {
	readonly patterns: readonly string[];
};

export const internals = defineInspection<InternalsParams>({
	program: 'checks/programs.ts',
	name: 'internals',
	concern: 'imports'
});
