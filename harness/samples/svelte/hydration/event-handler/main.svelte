<script>
	let { clicked = $bindable() } = $props();
</script>

<button onclick='{() => clicked = true}'>click me</button>

{#if clicked}
	<p>clicked!</p>
{/if}
