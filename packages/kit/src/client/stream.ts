export async function* readStream(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	delimiter: string,
	options?: TextDecoderOptions
): AsyncGenerator<string> {
	if (!delimiter.length) throw new TypeError('A stream delimiter cannot be empty');
	const decoder = new TextDecoder('utf-8', options);
	const fragments: string[] = [];
	let pending = '';
	try {
		while (true) {
			const { value, done } = await reader.read();
			pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
			let end: number;
			while ((end = pending.indexOf(delimiter)) >= 0) {
				fragments.push(pending.slice(0, end));
				yield fragments.join('');
				fragments.length = 0;
				pending = pending.slice(end + delimiter.length);
			}
			if (done) break;
			const stable = Math.max(0, pending.length - delimiter.length + 1);
			if (stable) fragments.push(pending.slice(0, stable));
			pending = pending.slice(stable);
		}
		if (pending || fragments.length) yield fragments.join('') + pending;
	} finally {
		try {
			await reader.cancel();
		} finally {
			reader.releaseLock();
		}
	}
}

export async function* readNdjson(
	reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<unknown> {
	for await (const line of readStream(reader, '\n', { fatal: true })) {
		if (line.trim()) yield JSON.parse(line);
	}
}

export function streamFrom<T>(values: AsyncIterable<T> | Iterable<T>): ReadableStream<T> {
	const iterator =
		Symbol.asyncIterator in values ? values[Symbol.asyncIterator]() : values[Symbol.iterator]();
	return new ReadableStream<T>({
		async pull(controller) {
			try {
				const next = await iterator.next();
				if (next.done) controller.close();
				else controller.enqueue(next.value);
			} catch (error) {
				controller.error(error);
			}
		},
		async cancel() {
			await iterator.return?.();
		}
	});
}

export function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
	return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
