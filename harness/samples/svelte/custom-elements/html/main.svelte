<svelte:options customElement="custom-element" />

<script>
	let { name } = $props();
</script>

<h1>Hello {name}!</h1>
