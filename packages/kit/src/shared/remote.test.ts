import { expect, test } from 'vitest';
import {
	decodeArgument,
	encodeArgument,
	encodeCommand,
	getRemoteKey,
	splitRemoteKey
} from './remote.ts';

test('query arguments have canonical wire bytes without losing reference identity or transport', () => {
	class Value {
		readonly value: number;
		constructor(value: number) {
			this.value = value;
		}
	}
	const transport = {
		Value: {
			encode: (value: unknown) => value instanceof Value && value.value,
			decode: (value: number) => new Value(value)
		}
	};
	const object: Record<string, any> = {
		z: new Set([2, 1]),
		a: new Map<string, unknown>([
			['b', 2],
			['a', new Value(3)]
		])
	};
	object.self = object;
	const reordered: Record<string, any> = {
		a: new Map<string, unknown>([
			['a', new Value(3)],
			['b', 2]
		]),
		z: new Set([1, 2])
	};
	reordered.self = reordered;
	const payload = encodeArgument(object, transport);
	expect(payload).toBe(encodeArgument(reordered, transport));
	expect(encodeArgument(42)).toBe('WzQyXQ');
	expect(encodeArgument(undefined)).toBe('');
	const decoded = decodeArgument(payload, transport);
	expect(decoded.self).toBe(decoded);
	expect(decoded.a.get('a')).toEqual(new Value(3));
	expect([...decoded.z]).toEqual([1, 2]);
	expect(Object.keys(object)).toEqual(['z', 'a', 'self']);
	expect(splitRemoteKey(getRemoteKey('hash/name', payload))).toEqual({ id: 'hash/name', payload });
	expect(() => encodeArgument(/x/)).toThrow();
});

test('commands carry files and preserve input order while rejecting application promises', async () => {
	const input = {
		z: new File(['hello'], 'value.txt', { type: 'text/plain', lastModified: -1 }),
		a: 1
	};
	const decoded = decodeArgument(await encodeCommand(input));
	expect(Object.keys(decoded)).toEqual(['z', 'a']);
	expect(decoded.z).toBeInstanceOf(File);
	expect(decoded.z.name).toBe('value.txt');
	expect(decoded.z.lastModified).toBe(-1);
	expect(await decoded.z.text()).toBe('hello');
	await expect(encodeCommand({ value: Promise.resolve(1) })).rejects.toThrow();
});
