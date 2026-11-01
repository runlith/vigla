import path from 'node:path';

function decoded(value: string): string {
	return value.replace(
		/\\([0-9a-f]{1,6})(?:\r\n|[\t\n\r\f ])?|\\([^\n\r\f])|\\(?:\r\n|[\n\r\f])/gi,
		(_, hex: string | undefined, char: string | undefined) =>
			hex
				? ((point) =>
						point === 0 || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)
							? '\ufffd'
							: String.fromCodePoint(point))(parseInt(hex, 16))
				: (char ?? '')
	);
}

export function styleExpression(
	css: string,
	stylesheet: string,
	files: Set<string>,
	staticFiles: Set<string>
): string {
	const parts: string[] = [];
	let index = 0,
		offset = 0;
	while (index < css.length) {
		if (css.startsWith('/*', index)) {
			const end = css.indexOf('*/', index + 2);
			index = end === -1 ? css.length : end + 2;
			continue;
		}
		if (css[index] === '"' || css[index] === "'") {
			const quote = css[index++]!;
			while (index < css.length) {
				if (css[index] === '\\') index += 2;
				else if (css[index++] === quote) break;
			}
			continue;
		}
		const open = /^url\(\s*/i.exec(css.slice(index));
		if (!open || (index && /[\w-]/.test(css[index - 1]!))) {
			index++;
			continue;
		}
		index += open[0].length;
		const quote = css[index] === '"' || css[index] === "'" ? css[index++] : undefined;
		const start = index;
		while (index < css.length) {
			if (css[index] === '\\') {
				index += 2;
				continue;
			}
			if (quote ? css[index] === quote : css[index] === ')') break;
			index++;
		}
		const end = quote ? index : start + css.slice(start, index).trimEnd().length;
		const value = decoded(css.slice(start, end));
		if (!/^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(value)) {
			const suffixAt = value.search(/[?#]/);
			const rawPath = suffixAt === -1 ? value : value.slice(0, suffixAt);
			const suffix = suffixAt === -1 ? '' : value.slice(suffixAt);
			let pathname = rawPath;
			try {
				pathname = decodeURIComponent(rawPath);
			} catch {}
			const target = path.posix.normalize(
				pathname.startsWith('/')
					? pathname.slice(1)
					: path.posix.join(path.posix.dirname(stylesheet), pathname)
			);
			if (files.has(target) || staticFiles.has(target)) {
				const prefix = staticFiles.has(target) ? 'base' : 'assets';
				const url = '/' + target.split('/').map(encodeURIComponent).join('/') + suffix;
				parts.push(
					JSON.stringify(css.slice(offset, start)),
					`(${prefix}.endsWith('/') ? ${prefix}.slice(0,-1) : ${prefix}) + ${JSON.stringify(url)}`
				);
				offset = end;
			}
		}
		if (quote && css[index] === quote) index++;
		if (css[index] === ')') index++;
	}
	parts.push(JSON.stringify(css.slice(offset)));
	return `(assets, base) => ${parts.join(' + ')}`;
}
