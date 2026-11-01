<script>
	let { x } = $props();
	const value = $derived(await x);
</script>

<p>{value}</p>
