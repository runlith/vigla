import { expect, it } from 'vitest';
import { deserialize, serialize } from './serialization.ts';
import { escapeHtml, escapeInterpolation, escapeJson } from './escape.ts';
import { hash, hashRequest } from './hash.ts';

class Coordinate {
	readonly x: number;
	readonly y: number;
	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
	}
}

it('roundtrips transported values alongside built-in rich data without shared codec state', () => {
	const transport = {
		Coordinate: {
			encode: (value: unknown) => value instanceof Coordinate && [value.x, value.y],
			decode: ([x, y]: number[]) => new Coordinate(x!, y!)
		}
	};
	const value = {
		place: new Coordinate(2, 3),
		at: new Date('2020-01-01T00:00:00Z'),
		map: new Map([['one', 1]])
	};
	expect(deserialize(serialize(value, transport), transport)).toEqual(value);
	expect(() => serialize(new Coordinate(2, 3))).toThrow();
});

it('escapes HTML, script data and interpolation at their different parser boundaries', () => {
	expect(escapeHtml('a&<\ud800')).toBe('a&amp;&lt;&#55296;');
	expect(escapeHtml('a&"<', true)).toBe('a&amp;&quot;<');
	expect(escapeJson('</script><!--\u2028')).toBe('"\\u003c/script>\\u003c!--\\u2028"');
	expect(
		escapeInterpolation('`$x\\${assets}', [
			{ placeholder: '\\${assets}', replacement: '${assets}' }
		])
	).toContain('\\`\\$x');
});

it('uses the same replay key for equivalent headers and exact typed-array windows', () => {
	const bytes = new Uint8Array([0, 97, 98, 0]);
	expect(hash(bytes.subarray(1, 3))).toBe(hash('ab'));
	expect(hashRequest({ accept: 'json', 'x-id': '1' }, 'body')).toBe(
		hash([...new Headers({ 'x-id': '1', accept: 'json' })].join(','), 'body')
	);
	expect(hashRequest(undefined, 'other')).not.toBe(hashRequest(undefined, 'body'));
});
