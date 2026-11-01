import { effect, template, teardown } from '../reactivity/effects.ts';
import { unowned } from './events.ts';

type Get<T> = () => T;
type Set<T> = (value: T) => void;

export interface TimeRange {
	readonly start: number;
	readonly end: number;
}

interface MediaValues {
	buffered: TimeRange[];
	seekable: TimeRange[];
	played: TimeRange[];
	duration: number;
	seeking: boolean;
	ended: boolean;
	readyState: number;
}

interface Controls {
	muted: boolean;
	volume: number;
	playbackRate: number;
}

const changes: Readonly<Record<keyof MediaValues, readonly string[]>> = {
	buffered: ['loadedmetadata', 'progress', 'timeupdate', 'seeking'],
	seekable: ['loadedmetadata'],
	played: ['timeupdate'],
	duration: ['durationchange'],
	seeking: ['seeking', 'seeked'],
	ended: ['timeupdate', 'ended'],
	readyState: [
		'loadedmetadata',
		'loadeddata',
		'canplay',
		'canplaythrough',
		'playing',
		'waiting',
		'emptied'
	]
};

function subscribe(
	media: HTMLMediaElement,
	events: readonly string[],
	read: () => void,
	initial = true
): void {
	const callback = (): void => unowned(read);
	if (initial) callback();
	for (const name of events) media.addEventListener(name, callback);
	teardown(() => {
		for (const name of events) media.removeEventListener(name, callback);
	});
}

function ranges(value: TimeRanges): TimeRange[] {
	return Array.from({ length: value.length }, (_, index) => ({
		start: value.start(index),
		end: value.end(index)
	}));
}

function sameRanges(previous: readonly TimeRange[] | undefined, current: TimeRanges): boolean {
	if (previous === undefined || previous.length !== current.length) return false;
	return previous.every(
		(range, index) => range.start === current.start(index) && range.end === current.end(index)
	);
}

export function bindMedia<K extends keyof MediaValues>(
	media: HTMLMediaElement,
	name: K,
	set: Set<MediaValues[K]>
): void {
	let previous: TimeRange[] | undefined;
	subscribe(media, changes[name], () => {
		let value: unknown;
		if (name === 'buffered') {
			const current = media.buffered;
			if (sameRanges(previous, current)) return;
			value = previous = ranges(current);
		} else if (name === 'seekable' || name === 'played')
			value = ranges(name === 'seekable' ? media.seekable : media.played);
		else value = media[name];
		set(value as MediaValues[K]);
	});
}

export function bindMediaControl<K extends keyof Controls>(
	media: HTMLMediaElement,
	name: K,
	get: Get<unknown>,
	set: Set<Controls[K]>
): void {
	const read = (): void => set(media[name] as Controls[K]);
	const write = (): void => {
		if (name === 'muted') {
			const next = Boolean(get());
			if (media.muted !== next) media.muted = next;
		} else {
			const next = Number(get());
			const property = name as 'volume' | 'playbackRate';
			if (!Number.isNaN(next) && media[property] !== next) media[property] = next;
		}
	};
	if (name === 'playbackRate') {
		effect(write);
		effect(() => subscribe(media, ['ratechange'], read));
	} else {
		if (unowned(get) == null) unowned(read);
		subscribe(media, ['volumechange'], read, false);
		template(write);
	}
}

export function bindCurrentTime(
	media: HTMLMediaElement,
	get: Get<unknown>,
	set: Set<number>
): void {
	let frame = 0;
	let value = Number.NaN;
	const read = (): void => {
		cancelAnimationFrame(frame);
		if (!media.paused) frame = requestAnimationFrame(() => unowned(read));
		const next = media.currentTime;
		if (next !== value) set((value = next));
	};
	frame = requestAnimationFrame(() => unowned(read));
	subscribe(media, ['timeupdate'], read, false);
	template(() => {
		const next = Number(get());
		if (next === value || Number.isNaN(next)) return;
		value = next;
		media.currentTime = next;
	});
	teardown(() => cancelAnimationFrame(frame));
}

export function bindPaused(media: HTMLMediaElement, get: Get<unknown>, set: Set<boolean>): void {
	let paused = unowned(get);
	subscribe(
		media,
		['play', 'pause', 'canplay'],
		() => {
			if (paused !== media.paused) set((paused = media.paused));
		},
		paused == null
	);
	effect(() => {
		paused = Boolean(get());
		if (paused === media.paused) return;
		if (paused) media.pause();
		else
			void media.play().catch((error: unknown) => {
				unowned(() => set((paused = true)));
				throw error;
			});
	});
}
