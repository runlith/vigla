export interface Capture {
	readonly rect: DOMRect;
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
	return {
		rect: element.getBoundingClientRect(),
		width: style.width,
		height: style.height,
		transform: style.transform === 'none' ? '' : style.transform,
		origin: style.transformOrigin,
		opacity: +style.opacity,
		position: style.position
	};
}

export class Placement {
	readonly element: Element;
	readonly #holders = new Set<object>();
	readonly #styles = new Map<string, Lease>();

	constructor(element: Element) {
		this.element = element;
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

	acquire(from: Capture): () => void {
		const holder = {};
		if (this.#holders.size === 0 && from.position !== 'absolute' && from.position !== 'fixed') {
			this.#write('position', 'absolute');
			this.#write('width', from.width);
			this.#write('height', from.height);
			const to = this.element.getBoundingClientRect();
			const x = from.rect.left - to.left;
			const y = from.rect.top - to.top;
			if (x !== 0 || y !== 0) {
				this.#write('transform', `translate(${x}px, ${y}px) ${from.transform}`, '');
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
