<script>
	let { name = $bindable() } = $props();
</script>

<input bind:value={name}>
<p>Hello {name}!</p>