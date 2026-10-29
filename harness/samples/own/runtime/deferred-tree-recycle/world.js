export const probe = { loaded: 0, built: 0 };

let chunk = null;
let instance = null;
let owner = null;

function load() {
	if (chunk === null) {
		probe.loaded += 1;
		chunk = new Promise((resolve) => setTimeout(resolve, 0)).then(() => ({
			find: (query) => `hit:${query}`
		}));
	}
	return chunk;
}

export async function search(session) {
	const engine = await load();
	if (instance === null || owner !== session) {
		probe.built += 1;
		const id = probe.built;
		instance = { find: (query) => `${engine.find(query)}#${id}` };
		owner = session;
	}
	return instance;
}
