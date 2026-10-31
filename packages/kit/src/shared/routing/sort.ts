import { routeSegments, segmentTokens } from './pattern.ts';

interface SortRoute {
	id: string;
}
interface Part {
	text: string;
	kind: 'static' | 'required' | 'optional' | 'rest';
	matched: boolean;
}

function staticOrder(a: string, b: string): number {
	for (let i = 0; i < Math.max(a.length, b.length); i++) {
		if (a[i] === b[i]) continue;
		if (a[i] === undefined) return 1;
		if (b[i] === undefined) return -1;
		return a[i]! < b[i]! ? -1 : 1;
	}
	return 0;
}

export function sortRoutes<T extends SortRoute>(routes: T[]): T[] {
	const parsed = new Map<string, Part[][]>();
	const parts = (id: string): Part[][] => {
		let value = parsed.get(id);
		if (!value) {
			value = routeSegments(id.replace(/\[\[[^\]]+\]\](?!(?:\/\([^/]+\))*$)/g, '')).map((segment) =>
				segmentTokens(segment).map(({ text, param }) => ({
					text,
					kind: !param ? 'static' : param.rest ? 'rest' : param.optional ? 'optional' : 'required',
					matched: !!param?.matcher
				}))
			);
			parsed.set(id, value);
		}
		return value;
	};
	return routes.sort((a, b) => {
		const left = parts(a.id);
		const right = parts(b.id);
		for (let segment = 0; segment < Math.max(left.length, right.length); segment++) {
			const l = left[segment];
			const r = right[segment];
			if (!l || !r) return l ? 1 : -1;
			for (let piece = 0; piece < Math.max(l.length, r.length); piece++) {
				const x = l[piece];
				const y = r[piece];
				if (!x || !y) return x ? 1 : -1;
				if (x.kind === 'static' && y.kind === 'static') {
					const order = staticOrder(x.text, y.text);
					if (order) return order;
					continue;
				}
				const afterX = l[piece + 1]?.text || left[segment + 1]?.[0]?.text;
				const afterY = r[piece + 1]?.text || right[segment + 1]?.[0]?.text;
				if (x.kind === 'rest' && y.kind === 'rest') {
					if (afterX && afterY) continue;
					if (!!afterX !== !!afterY) return afterX ? -1 : 1;
				}
				if (x.kind === 'rest') return afterX && !afterY ? -1 : 1;
				if (y.kind === 'rest') return afterY && !afterX ? 1 : -1;
				if (x.matched !== y.matched) return x.matched ? -1 : 1;
				if (x.kind !== y.kind) return x.kind === 'required' ? -1 : 1;
			}
		}
		return a.id === b.id ? 0 : a.id < b.id ? 1 : -1;
	});
}
