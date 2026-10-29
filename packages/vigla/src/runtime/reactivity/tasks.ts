let tasks: (() => void)[] = [];

function arm(): void {
	const queued = tasks;
	queueMicrotask(() => {
		if (queued === tasks) drain();
	});
}

export function task(fn: () => void): void {
	if (tasks.length === 0) arm();
	tasks.push(fn);
}

export function drain(): void {
	while (tasks.length > 0) {
		const run = tasks;
		tasks = [];
		let index = 0;
		try {
			for (; index < run.length; index++) (run[index] as () => void)();
		} catch (error) {
			const rest = run.slice(index + 1);
			if (rest.length > 0) {
				const later = tasks;
				tasks = rest;
				tasks.push(...later);
				arm();
			}
			throw error;
		}
	}
}
