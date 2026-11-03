export async function load() {
	await new Promise((resolve) => setTimeout(resolve, 50));
	return { layout: true };
}
