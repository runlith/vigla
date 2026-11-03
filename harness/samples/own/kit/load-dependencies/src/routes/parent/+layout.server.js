let runs = 0;

export function load() {
	return { version: ++runs };
}
