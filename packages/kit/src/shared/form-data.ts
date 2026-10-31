import { parse, stringify } from 'devalue';
import type { BinaryFormMeta } from '../types/internal/remote.ts';
import { HttpError } from './outcomes.ts';
import { coerceFormValue, parseFormKey, setNestedValue } from './form-fields.ts';
import * as errors from './errors.ts';

export type { BinaryFormMeta } from '../types/internal/remote.ts';

export interface DecodedForm {
	data: Record<string, any>;
	meta: BinaryFormMeta;
	formData: FormData | null;
}
export const BINARY_FORM_CONTENT_TYPE = 'application/x-sveltekit-formdata';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function convertFormData(formId: string, data: FormData): Record<string, any> {
	const result: Record<string, any> = {};
	for (const key of new Set(data.keys())) {
		const field = parseFormKey(formId, key);
		const entries = data
			.getAll(key)
			.filter((entry) => typeof entry === 'string' || entry.name || entry.size);
		if (!entries.length && !field.isArray) continue;
		if (entries.length > 1 && !field.isArray) {
			errors.form_field_duplicate({ name: field.name, count: String(entries.length) });
		}
		setNestedValue(
			result,
			field,
			coerceFormValue(field.type, field.isArray ? entries : entries[0])
		);
	}
	return result;
}

export function serializeBinaryForm(
	data: Record<string, any>,
	meta: BinaryFormMeta
): { blob: Blob } {
	const files: Array<{ file: File; index: number }> = [];
	const header = encoder.encode(
		stringify([data, meta], {
			File(value: unknown) {
				if (!(value instanceof File)) return;
				const index = files.length;
				files.push({ file: value, index });
				return [value.name, value.type, value.size, value.lastModified, index];
			}
		})
	);
	files.sort((a, b) => a.file.size - b.file.size);
	const offsets: number[] = [];
	let position = 0;
	for (const { file, index } of files) {
		offsets[index] = position;
		position += file.size;
	}
	const table = files.length ? JSON.stringify(offsets) : '';
	const prefix = new Uint8Array(7);
	const view = new DataView(prefix.buffer);
	view.setUint32(1, header.byteLength, true);
	view.setUint16(5, table.length, true);
	return { blob: new Blob([prefix, header, table, ...files.map(({ file }) => file)]) };
}

function invalid(detail: string): never {
	const error = new HttpError({ status: 400, message: 'Bad Request' });
	Object.defineProperty(error, 'message', {
		value: `Could not deserialize binary form: ${detail}`
	});
	throw error;
}

class BodyRanges {
	readonly #reader: ReadableStreamDefaultReader<Uint8Array>;
	readonly #chunks: Array<Promise<Uint8Array | undefined>> = [];

	constructor(body: ReadableStream<Uint8Array>) {
		this.#reader = body.getReader();
	}

	chunk(index: number): Promise<Uint8Array | undefined> {
		while (this.#chunks.length <= index) {
			const previous = this.#chunks.at(-1) ?? Promise.resolve(undefined);
			this.#chunks.push(previous.then(() => this.#reader.read()).then((result) => result.value));
		}
		return this.#chunks[index]!;
	}

	async *range(offset: number, length: number): AsyncGenerator<Uint8Array> {
		let start = 0;
		for (let index = 0; ; index++) {
			const chunk = await this.chunk(index);
			if (!chunk) return;
			const end = start + chunk.byteLength;
			if (end > offset) {
				yield chunk.subarray(
					Math.max(offset - start, 0),
					Math.min(chunk.byteLength, offset + length - start)
				);
				if (offset + length <= end) return;
			}
			start = end;
		}
	}

	async bytes(offset: number, length: number): Promise<Uint8Array> {
		const parts: Uint8Array[] = [];
		let size = 0;
		for await (const part of this.range(offset, length)) {
			parts.push(part);
			size += part.byteLength;
		}
		if (size !== length) invalid(offset === 0 ? 'too short' : 'data too short');
		if (parts.length === 1) return parts[0]!;
		const bytes = new Uint8Array(size);
		let cursor = 0;
		for (const part of parts) {
			bytes.set(part, cursor);
			cursor += part.byteLength;
		}
		return bytes;
	}

	async drain(): Promise<void> {
		while (await this.chunk(this.#chunks.length)) {}
	}
}

class DeferredFile implements File {
	readonly webkitRelativePath = '';
	readonly [Symbol.toStringTag] = 'File';
	readonly #body: BodyRanges;
	readonly #offset: number;
	#buffer?: ArrayBuffer;
	readonly name: string;
	readonly type: string;
	readonly size: number;
	readonly lastModified: number;

	constructor(
		name: string,
		type: string,
		size: number,
		lastModified: number,
		body: BodyRanges,
		offset: number
	) {
		this.name = name;
		this.type = type;
		this.size = size;
		this.lastModified = lastModified;
		this.#body = body;
		this.#offset = offset;
	}

	arrayBuffer = async (): Promise<ArrayBuffer> => {
		return (this.#buffer ??= await new Response(this.stream()).arrayBuffer());
	};
	bytes = async (): Promise<Uint8Array<ArrayBuffer>> => new Uint8Array(await this.arrayBuffer());
	text = async (): Promise<string> => decoder.decode(await this.arrayBuffer());
	slice = (start = 0, end = this.size, type = this.type): Blob => {
		const clamp = (offset: number) =>
			Math.min(this.size, Math.max(0, offset < 0 ? this.size + offset : offset));
		const from = clamp(start);
		return new DeferredFile(
			this.name,
			type,
			Math.max(0, clamp(end) - from),
			this.lastModified,
			this.#body,
			this.#offset + from
		);
	};
	stream = (): ReadableStream<Uint8Array<ArrayBuffer>> => {
		const range = this.#body.range(this.#offset, this.size);
		let read = 0;
		return new ReadableStream({
			pull: async (controller) => {
				const next = await range.next();
				if (next.done) {
					if (read < this.size) throw new Error('incomplete file data');
					controller.close();
				} else {
					read += next.value.byteLength;
					controller.enqueue(next.value as Uint8Array<ArrayBuffer>);
				}
			},
			cancel: async () => {
				await range.return(undefined);
			}
		});
	};
}

export async function deserializeBinaryForm(
	request: Request,
	formId: string
): Promise<DecodedForm> {
	if (request.headers.get('content-type') !== BINARY_FORM_CONTENT_TYPE) {
		const formData = await request.formData();
		return { data: convertFormData(formId, formData), meta: {}, formData };
	}
	if (!request.body) invalid('no body');
	const body = new BodyRanges(request.body);
	const prefix = await body.bytes(0, 7);
	if (prefix[0] !== 0) invalid(`got version ${prefix[0]}, expected version 0`);
	const view = new DataView(prefix.buffer, prefix.byteOffset, prefix.byteLength);
	const length = view.getUint32(1, true);
	const tableLength = view.getUint16(5, true);
	const header = decoder.decode(await body.bytes(7, length));
	const offsets: Array<number | undefined> = tableLength
		? JSON.parse(decoder.decode(await body.bytes(7 + length, tableLength)))
		: [];
	if (
		!Array.isArray(offsets) ||
		offsets.some((offset) => !Number.isInteger(offset) || offset! < 0)
	) {
		invalid('invalid file offset table');
	}
	const start = 7 + length + tableLength;
	const spans: Array<{ offset: number; size: number }> = [];
	const [data, meta] = parse(header, {
		File(metadata: unknown) {
			if (!Array.isArray(metadata)) invalid('invalid file metadata');
			const [name, type, size, modified, index] = metadata;
			if (
				typeof name !== 'string' ||
				typeof type !== 'string' ||
				!Number.isSafeInteger(size) ||
				size < 0 ||
				!Number.isSafeInteger(modified) ||
				!Number.isSafeInteger(index) ||
				index < 0
			)
				invalid('invalid file metadata');
			const offset = offsets[index];
			if (offset === undefined) invalid('duplicate file offset table index');
			offsets[index] = undefined;
			spans.push({ offset, size });
			return new Proxy(new DeferredFile(name, type, size, modified, body, start + offset), {
				getPrototypeOf: () => File.prototype
			});
		}
	});
	spans.sort((a, b) => a.offset - b.offset || a.size - b.size);
	for (let index = 1; index < spans.length; index++) {
		const end = spans[index - 1]!.offset + spans[index - 1]!.size;
		if (end < spans[index]!.offset) invalid('gaps in file data');
		if (end > spans[index]!.offset) invalid('overlapping file data');
	}
	void body.drain().catch(() => {});
	return { data, meta, formData: null };
}
