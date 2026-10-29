import type { AnimationConfig } from './animate.ts';
import { cubicOut, type Easing } from './easing.ts';

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
	const ox = originX / node.clientWidth;
	const oy = originY / node.clientHeight;
	const zoom = zoomOf(node);
	const sx = node.clientWidth / to.width / zoom;
	const sy = node.clientHeight / to.height / zoom;
	const dx = (from.left + from.width * ox - (to.left + to.width * ox)) * sx;
	const dy = (from.top + from.height * oy - (to.top + to.height * oy)) * sy;
	const dsx = from.width / to.width;
	const dsy = from.height / to.height;
	return {
		delay,
		duration: typeof duration === 'function' ? duration(Math.sqrt(dx * dx + dy * dy)) : duration,
		easing,
		css: (t, u) =>
			`transform: ${transform} translate(${u * dx}px, ${u * dy}px) scale(${t + u * dsx}, ${t + u * dsy});`
	};
}
