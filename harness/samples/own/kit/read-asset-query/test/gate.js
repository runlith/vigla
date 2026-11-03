import { test as base } from '@playwright/test';
import { gate } from '@vigla/harness/kit/gate';

export { expect } from '@playwright/test';

export const test = base.extend({
	harness_gate: [
		async ({}, use, info) => {
			gate(info);
			await use(undefined);
		},
		{ auto: true }
	]
});
