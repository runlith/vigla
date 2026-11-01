<script>
	const requirements = $state({ a: 1 });
	async function process(key, value, delay = 100) {
		await new Promise(resolve => setTimeout(resolve, delay));
		return [key, value];
	}
	const working = $derived.by(async () => {
		const out = {};
		for (const [key, value] of Object.entries(requirements)) {
			const [name, result] = await process(key, value, 200);
			out[name] = result;
		}
		return out;
	});
	// svelte-ignore state_referenced_locally
	working;
	const broken = $derived(Object.fromEntries(
		await Promise.all(Object.entries(requirements).map(async ([key, value]) => {
			const result = await process(key, value);
			return result;
		}))
	));
</script>

<pre>{JSON.stringify(broken)}</pre>
<pre>{JSON.stringify(await working)}</pre>
