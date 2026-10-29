<script>
	let { foo, bar } = $props();
</script>

{#if foo}
	<p>foo!</p>
{/if}

{#if bar}
	<p>bar!</p>
{/if}