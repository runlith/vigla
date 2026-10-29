<svelte:options customElement={{ shadow: "none" }} />

<script>
	let { name } = $props();
</script>

<h1>Hello {name}!</h1>
