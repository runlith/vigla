import { framed, probe, project, type Pose } from './frame.ts';

export interface Capture extends Pose {
	readonly width: string;
	readonly height: string;
	readonly transform: string;
	readonly origin: string;
	readonly opacity: number;
	readonly position: string;
}

interface Declaration {
	readonly value: string;
	readonly priority: string;
}

interface Lease {
	readonly before: Declaration;
	readonly written: Declaration;
}

export function capture(element: Element): Capture {
	const style = getComputedStyle(element);
	const rect = element.getBoundingClientRect();
	const transform = style.transform === 'none' ? '' : style.transform;
	return {
		rect,
		width: style.width,
		height: style.height,
		transform,
		origin: style.transformOrigin,
		opacity: +style.opacity,
		position: style.position,
		frame: framed(element, style, rect) ? probe(element, style, transform) : null
	};
}

export const GEOMETRY = ['transform', 'transformOrigin', 'translate', 'rotate', 'scale'] as const;

export class Placement {
	readonly element: Element;
	readonly #holders = new Set<object>();
	readonly #styles = new Map<string, Lease>();
	readonly #animations = new Map<Animation, readonly Keyframe[]>();

	constructor(element: Element) {
		this.element = element;
	}

	adopt(animation: Animation, frames: readonly Keyframe[]): void {
		this.#animations.set(animation, frames);
	}

	release(animation: Animation): void {
		this.#animations.delete(animation);
	}

	seize(properties: readonly string[]): boolean {
		let seized = false;
		for (const [animation, frames] of this.#animations) {
			if (!frames.some((frame) => properties.some((property) => property in frame))) continue;
			const kept = frames.map((frame) => {
				const rest: Keyframe = {};
				for (const property in frame)
					if (!properties.includes(property)) rest[property] = frame[property];
				return rest;
			});
			(animation.effect as KeyframeEffect).setKeyframes(kept);
			this.#animations.set(animation, kept);
			seized = true;
		}
		return seized;
	}

	#write(property: string, value: string, priority = 'important'): void {
		const style = (this.element as HTMLElement | SVGElement).style;
		const before = {
			value: style.getPropertyValue(property),
			priority: style.getPropertyPriority(property)
		};
		style.setProperty(property, value, priority);
		this.#styles.set(property, {
			before,
			written: {
				value: style.getPropertyValue(property),
				priority: style.getPropertyPriority(property)
			}
		});
	}

	#offset(from: Capture): boolean {
		const element = this.element;
		const frame = probe(element, getComputedStyle(element), from.transform);
		if (frame === null) return false;
		const local = project(from, { rect: element.getBoundingClientRect(), frame });
		if (local === null) return false;
		const { left, top } = local.from;
		if (left !== 0 || top !== 0) {
			this.seize(['transform']);
			const shift = `translate(${left}px, ${top}px)`;
			this.#write('transform', from.transform === '' ? shift : `${from.transform} ${shift}`, '');
		}
		return true;
	}

	acquire(from: Capture): () => void {
		const holder = {};
		if (this.#holders.size === 0 && from.position !== 'absolute' && from.position !== 'fixed') {
			this.#write('position', 'absolute');
			this.#write('width', from.width);
			this.#write('height', from.height);
			if (from.frame === null || !this.#offset(from)) {
				const to = this.element.getBoundingClientRect();
				const x = from.rect.left - to.left;
				const y = from.rect.top - to.top;
				if (x !== 0 || y !== 0) {
					this.seize(['transform']);
					this.#write('transform', `translate(${x}px, ${y}px) ${from.transform}`, '');
				}
			}
		}
		this.#holders.add(holder);
		return () => {
			if (this.#holders.delete(holder) && this.#holders.size === 0) this.restore();
		};
	}

	restore(): void {
		const style = (this.element as HTMLElement | SVGElement).style;
		for (const [property, { before, written }] of this.#styles) {
			if (
				style.getPropertyValue(property) !== written.value ||
				style.getPropertyPriority(property) !== written.priority
			)
				continue;
			if (before.value === '') style.removeProperty(property);
			else style.setProperty(property, before.value, before.priority);
		}
		this.#styles.clear();
		this.#holders.clear();
	}
}

const placements = new WeakMap<Element, Placement>();

export function placementOf(element: Element): Placement {
	let found = placements.get(element);
	if (found === undefined) placements.set(element, (found = new Placement(element)));
	return found;
}
