export type HashInput = string | ArrayBufferView;

export function hash(...values: HashInput[]): string {
	let state = 5381;
	for (const value of values) {
		if (typeof value === 'string') {
			for (let index = value.length - 1; index >= 0; index--)
				state = Math.imul(state, 33) ^ value.charCodeAt(index);
		} else if (ArrayBuffer.isView(value)) {
			const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
			for (let index = bytes.length - 1; index >= 0; index--)
				state = Math.imul(state, 33) ^ bytes[index]!;
		} else throw new TypeError('value must be a string or TypedArray');
	}
	return (state >>> 0).toString(36);
}

export function hashRequest(headers?: HeadersInit, body?: HashInput | null): string {
	const values: HashInput[] = [];
	if (headers) values.push([...new Headers(headers)].join(','));
	if (body) values.push(body);
	return hash(...values);
}

export function base64(bytes: Uint8Array): string {
	let value = '';
	for (let index = 0; index < bytes.length; index += 8192)
		value += String.fromCharCode(...bytes.subarray(index, index + 8192));
	return btoa(value);
}

export async function sha256(value: string): Promise<string> {
	return base64(
		new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
	);
}
