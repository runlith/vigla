export const methods = [
	'GET',
	'POST',
	'PUT',
	'PATCH',
	'DELETE',
	'OPTIONS',
	'HEAD',
	'QUERY'
] as const;

interface MediaRange {
	major: string;
	minor: string;
	quality: number;
	order: number;
}

export function negotiate(accept: string, available: readonly string[]): string | undefined {
	const ranges: MediaRange[] = [];
	for (const [order, part] of accept.split(',').entries()) {
		const tokens = part.trim().split(';');
		const media = tokens.shift()!.trim().split('/');
		if (media.length !== 2 || !media[0] || !media[1]) continue;
		const quality = tokens.map((token) => token.trim()).find((token) => token.startsWith('q='));
		ranges.push({
			major: media[0],
			minor: media[1],
			quality: quality ? Number(quality.slice(2)) : 1,
			order
		});
	}
	ranges.sort(
		(a, b) =>
			b.quality - a.quality ||
			Number(a.minor === '*') - Number(b.minor === '*') ||
			Number(a.major === '*') - Number(b.major === '*') ||
			a.order - b.order
	);
	for (const range of ranges) {
		for (const type of available) {
			const [major, minor] = type.split('/');
			if (
				(range.major === '*' || range.major === major) &&
				(range.minor === '*' || range.minor === minor)
			)
				return type;
		}
	}
	return undefined;
}

export function matchesType(header: string | null | undefined, ...types: string[]): boolean {
	return types.includes(header?.split(';', 1)[0]?.trim().toLowerCase() ?? '');
}

export function isForm(request: Request): boolean {
	return matchesType(
		request.headers.get('content-type'),
		'application/x-www-form-urlencoded',
		'multipart/form-data',
		'text/plain',
		'application/x-sveltekit-formdata'
	);
}

export function isEndpoint(request: Request): boolean {
	if (!['GET', 'HEAD', 'POST'].includes(request.method)) return true;
	if (request.method === 'POST' && request.headers.get('x-sveltekit-action') === 'true')
		return false;
	return negotiate(request.headers.get('accept') ?? '*/*', ['*', 'text/html']) !== 'text/html';
}
