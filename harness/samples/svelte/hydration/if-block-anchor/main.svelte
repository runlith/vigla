<script>
	let { foo, bar } = $props();
</script>

<div>
	{#if foo}
		<p>foo!</p>
	{/if}

	{#if bar}
		<p>bar!</p>
	{/if}
</div>