import { expect, test } from 'vitest';
import { init } from './payload.ts';

test('initializing the same payload again keeps its chunk channel', () => {
	const global = init({ base: '' });
	const { defer, resolve } = global;
	expect(init(global)).toBe(global);
	expect(global.defer).toBe(defer);
	expect(global.resolve).toBe(resolve);
	expect(init({ base: '' }).defer).not.toBe(defer);
});
