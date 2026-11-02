import type { AnimationConfig } from './animate.ts';
import { cubicOut, type Easing } from './easing.ts';
import { layout } from './layout.ts';

export interface FlipParams {
	delay?: number;
	duration?: number | ((distance: number) => number);
	easing?: Easing;
}

function zoomOf(element: Element): number {
	const own = (element as Element & { currentCSSZoom?: number }).currentCSSZoom;
	if (own !== undefined) return own;
	let zoom = 1;
	for (let at: Element | null = element; at !== null; at = at.parentElement) {
		zoom *= +getComputedStyle(at).zoom;
	}
	return zoom;
}

export function flip(
	node: Element,
	{ from, to }: { from: DOMRect; to: DOMRect },
	params: FlipParams = {}
): AnimationConfig {
	const {
		delay = 0,
		duration = (distance: number) => Math.sqrt(distance) * 120,
		easing = cubicOut
	} = params;
	const style = getComputedStyle(node);
	const transform = style.transform === 'none' ? '' : style.transform;
	const [originX = 0, originY = 0] = style.transformOrigin.split(' ').map(parseFloat);
	const local = layout?.element === node ? layout.local(from, to) : null;
	let dx: number;
	let dy: number;
	let dsx: number;
	let dsy: number;
	if (local === null) {
		const ox = originX / node.clientWidth;
		const oy = originY / node.clientHeight;
		const zoom = zoomOf(node);
		const sx = node.clientWidth / to.width / zoom;
		const sy = node.clientHeight / to.height / zoom;
		dx = (from.left + from.width * ox - (to.left + to.width * ox)) * sx;
		dy = (from.top + from.height * oy - (to.top + to.height * oy)) * sy;
		dsx = from.width / to.width;
		dsy = from.height / to.height;
	} else {
		const source = local.from;
		const target = local.to;
		const ox = originX / target.width;
		const oy = originY / target.height;
		dx = source.left + source.width * ox - (target.left + target.width * ox);
		dy = source.top + source.height * oy - (target.top + target.height * oy);
		dsx = source.width / target.width;
		dsy = source.height / target.height;
	}
	return {
		delay,
		duration: typeof duration === 'function' ? duration(Math.sqrt(dx * dx + dy * dy)) : duration,
		easing,
		css: (t, u) =>
			`transform: ${transform} translate(${u * dx}px, ${u * dy}px) scale(${t + u * dsx}, ${t + u * dsy});`
	};
}
