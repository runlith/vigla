import { DEV } from 'esm-env';
import { warn } from '../../shared/diagnostics.ts';
import type { AnimationConfig } from './animate.ts';
import { cubicInOut, cubicOut, linear, type Easing } from './easing.ts';
import { layout, type LayoutContext, type LayoutPass, type LayoutPlan } from './layout.ts';
import { project } from './frame.ts';
import { capture, type Capture } from './placement.ts';

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
	const receiving = new Map<unknown, Transfer>();
	const sending = new Map<unknown, Transfer>();
	const fade = (
		from: Capture,
		to: Capture,
		params: CrossfadeParams,
		prepared = false
	): AnimationConfig => {
		const {
			delay = 0,
			duration = (distance: number) => Math.sqrt(distance) * 30,
			easing = cubicOut
		} = { ...defaults, ...params };
		const vx = from.rect.left - to.rect.left;
		const vy = from.rect.top - to.rect.top;
		const local = project(from, to);
		const dx = local === null ? vx : local.from.left - local.to.left;
		const dy = local === null ? vy : local.from.top - local.to.top;
		const dw = local === null ? from.rect.width / to.rect.width : local.from.width / local.to.width;
		const dh =
			local === null ? from.rect.height / to.rect.height : local.from.height / local.to.height;
		const anchored = prepared || local !== null;
		const [ox = 0, oy = 0] = anchored ? to.origin.split(' ').map(parseFloat) : [];
		const origin = anchored ? to.origin : 'top left';
		const distance = Math.sqrt(vx * vx + vy * vy);
		return {
			delay,
			duration: typeof duration === 'function' ? duration(distance) : duration,
			easing,
			css: (t, u) => `
				opacity: ${t * to.opacity};
				transform-origin: ${origin};
				transform: ${to.transform} translate(${u * (dx + (dw - 1) * ox)}px, ${u * (dy + (dh - 1) * oy)}px) scale(${t + u * dw}, ${t + u * dh});
			`
		};
	};

	class Pair {
		#sender: Transfer | null;
		#receiver: Transfer | null;
		#stabilized = false;
		#measured = false;
		readonly from: Capture;
		source!: Capture;
		target!: Capture;

		constructor(sender: Transfer, receiver: Transfer) {
			this.#sender = sender;
			this.#receiver = receiver;
			this.from = sender.context!.captured;
		}

		stabilize(): void {
			if (this.#stabilized) return;
			this.#stabilized = true;
			this.#sender!.pin();
		}

		measure(): void {
			if (this.#measured) return;
			this.#measured = true;
			this.source = capture(this.#sender!.node);
			this.target = capture(this.#receiver!.node);
			this.#sender = this.#receiver = null;
		}
	}

	class Transfer implements LayoutPlan {
		readonly node: Element;
		readonly context: LayoutContext | null;
		readonly params: Keyed;
		readonly intro: boolean;
		readonly #items: Map<unknown, Transfer>;
		readonly #counterparts: Map<unknown, Transfer>;
		#config: AnimationConfig | undefined;
		#stage: LayoutPass | null;
		#release: (() => void) | undefined;
		#resolved = false;
		#cancelled = false;
		pair: Pair | null = null;

		constructor(node: Element, params: Keyed, intro: boolean) {
			this.node = node;
			this.params = params;
			this.intro = intro;
			this.context = layout?.element === node ? layout : null;
			this.#items = intro ? receiving : sending;
			this.#counterparts = intro ? sending : receiving;
			this.#items.set(params.key, this);
			this.#stage = this.context?.stage(this) ?? null;
		}

		#remove(): void {
			if (this.#items.get(this.params.key) === this) this.#items.delete(this.params.key);
		}

		match(): void {
			if (this.#cancelled || this.pair !== null || this.#stage === null) return;
			const other = this.#counterparts.get(this.params.key);
			if (other === undefined || other.#cancelled || other.#stage !== this.#stage) return;
			this.pair = other.pair = this.intro ? new Pair(other, this) : new Pair(this, other);
			this.#remove();
			other.#remove();
		}

		pin(): void {
			const context = this.context;
			if (!this.#cancelled && context?.direction === 'out') {
				this.#release ??= context.placement.acquire(context.captured);
			}
		}

		stabilize(): void {
			if (!this.#cancelled) this.pair?.stabilize();
		}

		measure(): void {
			if (!this.#cancelled) this.pair?.measure();
		}

		read(): AnimationConfig | undefined {
			if (this.#resolved) return this.#config;
			if (this.#cancelled) return;
			if (this.#stage !== null && !this.#stage.ready) {
				this.#stage.withdraw(this);
				this.#stage = null;
			}
			const pair = this.pair;
			if (pair !== null) {
				this.#resolved = true;
				return (this.#config = this.intro
					? fade(pair.from, pair.target, this.params, true)
					: fade(pair.target, pair.source, this.params, true));
			}
			const other = this.#counterparts.get(this.params.key);
			if (other !== undefined) {
				this.#counterparts.delete(this.params.key);
				return fade(capture(other.node), capture(this.node), this.params);
			}
			this.#remove();
			return fallback?.(this.node, this.params as P, this.intro);
		}

		cancel(): void {
			if (this.#cancelled) return;
			this.#cancelled = true;
			this.#remove();
			this.#release?.();
			this.#release = undefined;
			this.pair = null;
		}
	}

	const half =
		(intro: boolean): Half =>
		(node, params) => {
			const transfer = new Transfer(node, params, intro);
			return () => transfer.read();
		};
	return [half(false), half(true)];
}
