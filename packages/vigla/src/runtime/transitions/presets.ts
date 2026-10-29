import { DEV } from 'esm-env';
import { warn } from '../../shared/diagnostics.ts';
import type { AnimationConfig } from './animate.ts';
import { cubicInOut, cubicOut, linear, type Easing } from './easing.ts';

export interface Timing {
	delay?: number;
	duration?: number;
	easing?: Easing;
}

export interface BlurParams extends Timing {
	amount?: number | string;
	opacity?: number;
}

export interface FlyParams extends Timing {
	x?: number | string;
	y?: number | string;
	opacity?: number;
}

export interface SlideParams extends Timing {
	axis?: 'x' | 'y';
}

export interface ScaleParams extends Timing {
	start?: number;
	opacity?: number;
}

export interface DrawParams {
	delay?: number;
	speed?: number;
	duration?: number | ((length: number) => number);
	easing?: Easing;
}

export interface CrossfadeParams {
	delay?: number;
	duration?: number | ((distance: number) => number);
	easing?: Easing;
}

type Measure = [value: number, unit: string];

function measure(value: number | string): Measure {
	const found = typeof value === 'string' && value.match(/^\s*(-?[\d.]+)([^\s]*)\s*$/);
	return found ? [parseFloat(found[1] as string), found[2] || 'px'] : [value as number, 'px'];
}

function transformOf(style: CSSStyleDeclaration): string {
	return style.transform === 'none' ? '' : style.transform;
}

export function blur(
	node: Element,
	{ delay = 0, duration = 400, easing = cubicInOut, amount = 5, opacity = 0 }: BlurParams = {}
): AnimationConfig {
	const style = getComputedStyle(node);
	const target = +style.opacity;
	const filter = style.filter === 'none' ? '' : style.filter;
	const drop = target * (1 - opacity);
	const [value, unit] = measure(amount);
	return {
		delay,
		duration,
		easing,
		css: (_t, u) => `opacity: ${target - drop * u}; filter: ${filter} blur(${u * value}${unit});`
	};
}

export function fade(
	node: Element,
	{ delay = 0, duration = 400, easing = linear }: Timing = {}
): AnimationConfig {
	const opacity = +getComputedStyle(node).opacity;
	return { delay, duration, easing, css: (t) => `opacity: ${t * opacity}` };
}

export function fly(
	node: Element,
	{ delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 }: FlyParams = {}
): AnimationConfig {
	const style = getComputedStyle(node);
	const target = +style.opacity;
	const transform = transformOf(style);
	const drop = target * (1 - opacity);
	const [xValue, xUnit] = measure(x);
	const [yValue, yUnit] = measure(y);
	return {
		delay,
		duration,
		easing,
		css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * xValue}${xUnit}, ${(1 - t) * yValue}${yUnit});
			opacity: ${target - drop * u}`
	};
}

let warned = false;

function dimension(property: string, value: number, t: number): string {
	return Number.isNaN(value) ? '' : `${property}: ${t * value}px;`;
}

export function slide(
	node: Element,
	{ delay = 0, duration = 400, easing = cubicOut, axis = 'y' }: SlideParams = {}
): AnimationConfig {
	const style = getComputedStyle(node);
	if (DEV && !warned && /(contents|inline|table)/.test(style.display)) {
		warned = true;
		void Promise.resolve().then(() => (warned = false));
		warn(
			'transition_slide_display',
			`The \`slide\` transition does not work correctly for elements with \`display: ${style.display}\``
		);
	}
	const opacity = +style.opacity;
	const primary = axis === 'y' ? 'height' : 'width';
	const size = parseFloat(style[primary]);
	const [start, end] = axis === 'y' ? (['top', 'bottom'] as const) : (['left', 'right'] as const);
	const read = (property: string): number => parseFloat(style.getPropertyValue(property));
	const padding = [read(`padding-${start}`), read(`padding-${end}`)];
	const margin = [read(`margin-${start}`), read(`margin-${end}`)];
	const border = [read(`border-${start}-width`), read(`border-${end}-width`)];
	return {
		delay,
		duration,
		easing,
		css: (t) =>
			'overflow: hidden;' +
			`opacity: ${Math.min(t * 20, 1) * opacity};` +
			dimension(primary, size, t) +
			dimension(`padding-${start}`, padding[0] as number, t) +
			dimension(`padding-${end}`, padding[1] as number, t) +
			dimension(`margin-${start}`, margin[0] as number, t) +
			dimension(`margin-${end}`, margin[1] as number, t) +
			dimension(`border-${start}-width`, border[0] as number, t) +
			dimension(`border-${end}-width`, border[1] as number, t) +
			`min-${primary}: 0`
	};
}

export function scale(
	node: Element,
	{ delay = 0, duration = 400, easing = cubicOut, start = 0, opacity = 0 }: ScaleParams = {}
): AnimationConfig {
	const style = getComputedStyle(node);
	const target = +style.opacity;
	const transform = transformOf(style);
	const shrink = 1 - start;
	const drop = target * (1 - opacity);
	return {
		delay,
		duration,
		easing,
		css: (_t, u) => `
			transform: ${transform} scale(${1 - shrink * u});
			opacity: ${target - drop * u}
		`
	};
}

export function draw(
	node: SVGElement & { getTotalLength(): number },
	{ delay = 0, speed, duration, easing = cubicInOut }: DrawParams = {}
): AnimationConfig {
	let length = node.getTotalLength();
	const style = getComputedStyle(node);
	if (style.strokeLinecap !== 'butt') length += parseInt(style.strokeWidth);
	const time =
		duration === undefined
			? speed === undefined
				? 800
				: length / speed
			: typeof duration === 'function'
				? duration(length)
				: duration;
	return {
		delay,
		duration: time,
		easing,
		css: (_, u) => `
			stroke-dasharray: ${length};
			stroke-dashoffset: ${u * length};
		`
	};
}

export type Fallback<P> = (node: Element, params: P, intro: boolean) => AnimationConfig;

export interface CrossfadeOptions<P> extends CrossfadeParams {
	fallback?: Fallback<P>;
}

type Keyed = CrossfadeParams & { key: unknown };

type Half = (node: Element, params: Keyed) => () => AnimationConfig | undefined;

export function crossfade<P extends Keyed>({
	fallback,
	...defaults
}: CrossfadeOptions<P>): [send: Half, receive: Half] {
	const receiving = new Map<unknown, Element>();
	const sending = new Map<unknown, Element>();
	const fade = (from: Element, node: Element, params: CrossfadeParams): AnimationConfig => {
		const {
			delay = 0,
			duration = (distance: number) => Math.sqrt(distance) * 30,
			easing = cubicOut
		} = { ...defaults, ...params };
		const start = from.getBoundingClientRect();
		const end = node.getBoundingClientRect();
		const dx = start.left - end.left;
		const dy = start.top - end.top;
		const dw = start.width / end.width;
		const dh = start.height / end.height;
		const distance = Math.sqrt(dx * dx + dy * dy);
		const style = getComputedStyle(node);
		const transform = transformOf(style);
		const opacity = +style.opacity;
		return {
			delay,
			duration: typeof duration === 'function' ? duration(distance) : duration,
			easing,
			css: (t, u) => `
			   opacity: ${t * opacity};
			   transform-origin: top left;
			   transform: ${transform} translate(${u * dx}px,${u * dy}px) scale(${t + (1 - t) * dw}, ${
						t + (1 - t) * dh
					});
		   `
		};
	};
	const half =
		(items: Map<unknown, Element>, counterparts: Map<unknown, Element>, intro: boolean): Half =>
		(node, params) => {
			items.set(params.key, node);
			return () => {
				const other = counterparts.get(params.key);
				if (other !== undefined) {
					counterparts.delete(params.key);
					return fade(other, node, params);
				}
				items.delete(params.key);
				return fallback?.(node, params as P, intro);
			};
		};
	return [half(sending, receiving, false), half(receiving, sending, true)];
}
