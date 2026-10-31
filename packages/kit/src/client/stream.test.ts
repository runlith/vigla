// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest';
import { root, type Owner } from 'vigla';
import { Transport } from './transport.ts';
import { stringify } from 'devalue';
import { readData } from './data.ts';
import { decodeBase64, readStream, streamFrom } from './stream.ts';
import { base64 } from '../shared/hash.ts';

const owners: Owner[] = [];
afterEach(() => {
	for (const owner of owners) owner.dispose();
	owners.length = 0;
});

function transport(decoders: Record<string, (value: any) => any> = {}): Transport {
	const owner = root();
	owners.push(owner);
	return new Transport(
		{
			global: '',
			nodes: [],
			serverLoads: [],
			dictionary: {},
			matchers: {},
			hooks: {},
			root: () => {},
			encoders: {},
			decoders
		},
		owner
	);
}

function chunks(text: string): ReadableStream<Uint8Array> {
	return streamFrom(Array.from(new TextEncoder().encode(text), (byte) => Uint8Array.of(byte)));
}

test('data responses revive split UTF-8 and settle streamed promises with app transport', async () => {
	const later = {};
	const token = {};
	const encoded = JSON.parse(
		stringify(
			{ title: 'café', token, later },
			{
				Promise: (value) => (value === later ? 9 : false),
				Token: (value) => (value === token ? 'secret-id' : false)
			}
		)
	);
	const initial = { type: 'data', nodes: [{ type: 'data', uses: {}, data: encoded }] };
	const chunk = { type: 'chunk', id: 9, data: JSON.parse(stringify(new Date('2025-01-01'))) };
	const response = await readData(
		new Response(chunks(`${JSON.stringify(initial)}\n${JSON.stringify(chunk)}\n`)),
		transport({ Token: (id) => ({ id }) })
	);
	expect(response.type).toBe('data');
	if (response.type !== 'data') throw new Error('Expected data');
	const node = response.nodes[0];
	if (node?.type !== 'data') throw new Error('Expected node');
	expect(node.data?.title).toBe('café');
	expect(node.data?.token).toEqual({ id: 'secret-id' });
	await expect(node.data?.later).resolves.toEqual(new Date('2025-01-01'));
});

test('data streams reject malformed UTF-8 and incomplete deferred values', async () => {
	const codecs = transport();
	await expect(readData(new Response(streamFrom([Uint8Array.of(255)])), codecs)).rejects.toThrow(
		TypeError
	);
	const promise = {};
	const data = JSON.parse(
		stringify({ value: promise }, { Promise: (value) => (value === promise ? 1 : false) })
	);
	const result = await readData(
		new Response(
			chunks(JSON.stringify({ type: 'data', nodes: [{ type: 'data', data, uses: {} }] }))
		),
		codecs
	);
	if (result.type !== 'data' || result.nodes[0]?.type !== 'data') throw new Error('Expected data');
	await expect(result.nodes[0].data?.value).rejects.toThrow('Incomplete data response');
});

test('stream blocks retain split delimiters, trailing frames and linear large frames', async () => {
	const values: string[] = [];
	const reader = streamFrom(
		['x'.repeat(100_000) + '\n', '\nshort\n\ntail'].map((value) => new TextEncoder().encode(value))
	).getReader();
	for await (const value of readStream(reader, '\n\n', { fatal: true })) values.push(value);
	expect(values).toEqual(['x'.repeat(100_000), 'short', 'tail']);
});

test('binary replay round trips UTF-8 and cancellation closes the producer', async () => {
	const bytes = new TextEncoder().encode('工é');
	expect([...decodeBase64(base64(bytes))]).toEqual([...bytes]);
	let closed = false;
	const stream = streamFrom(
		(async function* () {
			try {
				yield 1;
				yield 2;
			} finally {
				closed = true;
			}
		})()
	);
	const reader = stream.getReader();
	expect((await reader.read()).value).toBe(1);
	await reader.cancel();
	expect(closed).toBe(true);
});
