export interface Task {
	readonly promise: Promise<void>;
	abort(): void;
}

export function loop(step: (now: number) => boolean): Task {
	let handle = 0;
	let aborted = false;
	let finish!: () => void;
	const promise = new Promise<void>((done) => (finish = done));
	const frame = (now: number): void => {
		if (aborted) return;
		if (step(now)) request();
		else finish();
	};
	const request = (): void => {
		if (typeof requestAnimationFrame === 'function') handle = requestAnimationFrame(frame);
	};
	request();
	return {
		promise,
		abort() {
			aborted = true;
			if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle);
		}
	};
}
