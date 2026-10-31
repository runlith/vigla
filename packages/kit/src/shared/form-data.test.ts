import { expect, test } from 'vitest';
import {
	BINARY_FORM_CONTENT_TYPE,
	convertFormData,
	deserializeBinaryForm,
	serializeBinaryForm
} from './form-data.ts';

const request = (body: Blob) =>
	new Request('https://test/', {
		method: 'POST',
		body,
		headers: { 'content-type': BINARY_FORM_CONTENT_TYPE }
	});

test('binary forms preserve metadata and file ranges without a content length', async () => {
	const data = {
		large: new File(['large'], 'large.txt', { type: 'text/plain', lastModified: 10 }),
		small: new File(['a'], 'small.txt'),
		empty: new File([], 'empty.txt'),
		value: 1
	};
	const { blob } = serializeBinaryForm(data, {
		remote_refreshes: ['hash/query/'],
		validate_only: true
	});
	const decoded = await deserializeBinaryForm(request(blob), 'hash/form');
	expect(decoded.meta).toEqual({ remote_refreshes: ['hash/query/'], validate_only: true });
	expect(decoded.formData).toBeNull();
	expect(decoded.data.large).toBeInstanceOf(File);
	expect(decoded.data.large.size).toBe(5);
	expect(decoded.data.large.lastModified).toBe(10);
	expect(await decoded.data.large.slice(-3).text()).toBe('rge');
	expect(await decoded.data.small.text()).toBe('a');
	expect(await decoded.data.empty.text()).toBe('');
	const bytes = new Uint8Array(await blob.arrayBuffer());
	const prefix = new DataView(bytes.buffer);
	expect(prefix.getUint8(0)).toBe(0);
	const headerLength = prefix.getUint32(1, true);
	const tableLength = prefix.getUint16(5, true);
	expect(
		new TextDecoder().decode(bytes.subarray(7 + headerLength, 7 + headerLength + tableLength))
	).toBe('[1,0,0]');
	await expect(deserializeBinaryForm(request(blob.slice(0, 8)), '')).rejects.toMatchObject({
		status: 400
	});
});

test('native forms decode typed nested fields, reject ambiguous values and forbid prototype paths', () => {
	const data = new FormData();
	data.append('n:items[]/hash/form', '2');
	data.append('n:items[]/hash/form', '3');
	data.append('b:flags.enabled/hash/form', 'on');
	data.append('file/hash/form', new File([], ''));
	expect(convertFormData('hash/form', data)).toEqual({ items: [2, 3], flags: { enabled: true } });
	data.append('flags.enabled/hash/form', 'duplicate');
	data.append('flags.enabled/hash/form', 'duplicate');
	expect(() => convertFormData('hash/form', data)).toThrow();
	const attack = new FormData();
	attack.append('user.__proto__.value/form', 'bad');
	expect(() => convertFormData('form', attack)).toThrow();
});
