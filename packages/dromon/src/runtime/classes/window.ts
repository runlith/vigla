import { set, source } from '../reactivity/sources.ts';
import { get } from '../reactivity/tracking.ts';
import { Subscribed, type Start } from './subscriber.ts';

function on(...events: string[]): Start {
	return (update) => {
		for (const event of events) window.addEventListener(event, update);
		return () => {
			for (const event of events) window.removeEventListener(event, update);
		};
	};
}

function polled(read: () => number): Start {
	return (update) => {
		let value = read();
		let frame = requestAnimationFrame(function check() {
			frame = requestAnimationFrame(check);
			if (value !== (value = read())) update();
		});
		return () => cancelAnimationFrame(frame);
	};
}

export const scrollX = new Subscribed(() => window.scrollX, on('scroll'));

export const scrollY = new Subscribed(() => window.scrollY, on('scroll'));

export const innerWidth = new Subscribed(() => window.innerWidth, on('resize'));

export const innerHeight = new Subscribed(() => window.innerHeight, on('resize'));

export const outerWidth = new Subscribed(() => window.outerWidth, on('resize'));

export const outerHeight = new Subscribed(() => window.outerHeight, on('resize'));

export const screenLeft = new Subscribed(
	() => window.screenLeft,
	polled(() => window.screenLeft)
);

export const screenTop = new Subscribed(
	() => window.screenTop,
	polled(() => window.screenTop)
);

export const online = new Subscribed(() => navigator.onLine, on('online', 'offline'));

class PixelRatio {
	readonly #ratio = source(window.devicePixelRatio);

	constructor() {
		this.#watch();
	}

	#watch(): void {
		const list = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
		const changed = (): void => {
			list.removeEventListener('change', changed);
			set(this.#ratio, window.devicePixelRatio);
			this.#watch();
		};
		list.addEventListener('change', changed);
	}

	get current(): number {
		get(this.#ratio);
		return window.devicePixelRatio;
	}
}

export const devicePixelRatio = new PixelRatio();
