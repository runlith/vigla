export type Matrix = readonly [
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number
];

export interface Box {
	readonly left: number;
	readonly top: number;
	readonly width: number;
	readonly height: number;
}

export interface Frame {
	readonly map: Matrix;
	readonly inverse: Matrix;
	readonly width: number;
	readonly height: number;
}

export interface Pose {
	readonly rect: DOMRect;
	readonly flat: boolean;
	readonly frame: Frame | null;
}

export interface Projection {
	readonly from: Box;
	readonly to: Box;
}

const XHTML = 'http://www.w3.org/1999/xhtml';

const COLLAPSE = 1e-6;

let moving: Map<Element, boolean> | null = null;

export function sweep<T>(fn: () => T): T {
	if (moving !== null) return fn();
	moving = new Map();
	try {
		return fn();
	} finally {
		moving = null;
	}
}

function parentOf(element: Element): Element | null {
	if (element.assignedSlot !== null) return element.assignedSlot;
	if (element.parentElement !== null) return element.parentElement;
	const root = element.parentNode;
	return root !== null && 'host' in root ? (root as ShadowRoot).host : null;
}

function zoomed(style: CSSStyleDeclaration): boolean {
	const zoom = parseFloat(style.zoom);
	return zoom === zoom && zoom !== 1;
}

function moves(style: CSSStyleDeclaration): boolean {
	for (const value of [
		style.transform,
		style.perspective,
		style.translate,
		style.rotate,
		style.scale,
		style.offsetPath
	]) {
		if (value !== undefined && value !== '' && value !== 'none') return true;
	}
	return zoomed(style);
}

function above(element: Element): boolean {
	const parent = parentOf(element);
	if (parent === null) return false;
	let found = moving?.get(parent);
	if (found === undefined) {
		found = moves(getComputedStyle(parent)) || above(parent);
		moving?.set(parent, found);
	}
	return found;
}

function transitionable(style: CSSStyleDeclaration): boolean {
	const durations = style.transitionDuration.split(',');
	const delays = style.transitionDelay.split(',');
	return style.transitionProperty.split(',').some((property, at) => {
		const name = property.trim();
		if (name !== 'all' && name !== 'transform') return false;
		const duration = parseFloat(durations[at % durations.length] as string) || 0;
		const delay = parseFloat(delays[at % delays.length] as string) || 0;
		return Math.max(duration, 0) + delay > 0;
	});
}

export function poseOf(
	element: Element,
	style: CSSStyleDeclaration,
	rect: DOMRect,
	transform: string
): Pose {
	if (element.namespaceURI !== XHTML || !(rect.width > 0 && rect.height > 0)) {
		return { rect, flat: false, frame: null };
	}
	if (!moves(style) && !above(element)) return { rect, flat: true, frame: null };
	const frame = transitionable(style) ? null : probe(element, style, transform);
	return { rect, flat: false, frame };
}

function length(style: CSSStyleDeclaration, axis: 'width' | 'height'): number {
	const value = parseFloat(style[axis]);
	if (style.boxSizing === 'border-box') return value;
	const [start, end] = axis === 'width' ? ['left', 'right'] : ['top', 'bottom'];
	let total = value;
	for (const property of [
		`padding-${start}`,
		`padding-${end}`,
		`border-${start}-width`,
		`border-${end}-width`
	]) {
		total += parseFloat(style.getPropertyValue(property));
	}
	return total;
}

export function apply(matrix: Matrix, x: number, y: number): [number, number] {
	const w = matrix[6] * x + matrix[7] * y + matrix[8];
	return [
		(matrix[0] * x + matrix[1] * y + matrix[2]) / w,
		(matrix[3] * x + matrix[4] * y + matrix[5]) / w
	];
}

function solve(points: readonly number[], width: number, height: number): Matrix | null {
	const [x0, y0, x1, y1, x2, y2, x3, y3] = points as [
		number,
		number,
		number,
		number,
		number,
		number,
		number,
		number
	];
	const sx = x0 - x1 + x2 - x3;
	const sy = y0 - y1 + y2 - y3;
	const dx1 = x1 - x2;
	const dx2 = x3 - x2;
	const dy1 = y1 - y2;
	const dy2 = y3 - y2;
	const det = dx1 * dy2 - dx2 * dy1;
	if (det === 0 || !Number.isFinite(det)) return null;
	const g = (sx * dy2 - dx2 * sy) / det;
	const h = (dx1 * sy - sx * dy1) / det;
	return [
		(x1 - x0 + g * x1) / width,
		(x3 - x0 + h * x3) / height,
		x0,
		(y1 - y0 + g * y1) / width,
		(y3 - y0 + h * y3) / height,
		y0,
		g / width,
		h / height,
		1
	];
}

function invert(m: Matrix): Matrix | null {
	const [a, b, c, d, e, f, g, h, i] = m;
	const A = e * i - f * h;
	const B = f * g - d * i;
	const C = d * h - e * g;
	const det = a * A + b * B + c * C;
	if (det === 0 || !Number.isFinite(det)) return null;
	return [
		A / det,
		(c * h - b * i) / det,
		(b * f - c * e) / det,
		B / det,
		(a * i - c * g) / det,
		(c * d - a * f) / det,
		C / det,
		(b * g - a * h) / det,
		(a * e - b * d) / det
	];
}

function probe(element: Element, style: CSSStyleDeclaration, transform: string): Frame | null {
	const width = length(style, 'width');
	const height = length(style, 'height');
	if (!(width > 0 && height > 0)) return null;
	const [ox = 0, oy = 0] = style.transformOrigin.split(' ').map(parseFloat);
	const inline = (element as HTMLElement).style;
	const text = element.getAttribute('style');
	const points: number[] = [];
	try {
		for (const [x, y] of [
			[0, 0],
			[width, 0],
			[width, height],
			[0, height]
		] as const) {
			inline.setProperty(
				'transform',
				`${transform} translate(${x - ox}px, ${y - oy}px) scale(${COLLAPSE}) translate(${ox - width / 2}px, ${oy - height / 2}px)`,
				'important'
			);
			const rect = element.getBoundingClientRect();
			points.push((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2);
		}
	} finally {
		if (text === null) element.removeAttribute('style');
		else if (element.getAttribute('style') !== text) element.setAttribute('style', text);
	}
	const map = solve(points, width, height);
	const inverse = map === null ? null : invert(map);
	return map === null || inverse === null ? null : { map, inverse, width, height };
}

function corners({ rect, frame }: Pose): number[] {
	if (frame === null) {
		return [
			rect.left,
			rect.top,
			rect.right,
			rect.top,
			rect.right,
			rect.bottom,
			rect.left,
			rect.bottom
		];
	}
	const { map, width, height } = frame;
	return [
		...apply(map, 0, 0),
		...apply(map, width, 0),
		...apply(map, width, height),
		...apply(map, 0, height)
	];
}

export function project(from: Pose, to: Pose): Projection | null {
	if ((from.flat && to.flat) || (!from.flat && from.frame === null)) return null;
	if (!to.flat && to.frame === null) return null;
	const points = corners(from);
	let left = Infinity;
	let top = Infinity;
	let right = -Infinity;
	let bottom = -Infinity;
	for (let at = 0; at < points.length; at += 2) {
		const vx = points[at] as number;
		const vy = points[at + 1] as number;
		const [x, y] =
			to.frame === null ? [vx - to.rect.left, vy - to.rect.top] : apply(to.frame.inverse, vx, vy);
		left = Math.min(left, x);
		top = Math.min(top, y);
		right = Math.max(right, x);
		bottom = Math.max(bottom, y);
	}
	const width = to.frame === null ? to.rect.width : to.frame.width;
	const height = to.frame === null ? to.rect.height : to.frame.height;
	return {
		from: { left, top, width: right - left, height: bottom - top },
		to: { left: 0, top: 0, width, height }
	};
}
