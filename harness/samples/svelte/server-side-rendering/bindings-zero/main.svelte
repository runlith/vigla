<script>
	let { foo = 0 } = $props();
</script>

<input type="number" bind:value={foo} >
<input type="range" bind:value={foo} >