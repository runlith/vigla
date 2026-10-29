<svelte:options customElement="custom-element" />

<script>
	let { count = 0 } = $props();
</script>

<button onclick={() => count++}>{count}</button>
