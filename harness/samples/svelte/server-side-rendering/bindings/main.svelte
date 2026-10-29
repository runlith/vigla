<script>
	let { foo = 'bar' } = $props();
</script>

<input bind:value={foo} >