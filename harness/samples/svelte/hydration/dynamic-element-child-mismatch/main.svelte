<script>
	let { condition, tag = 'div' } = $props();
</script>

<svelte:element this={tag}>
	{#if condition}<p>client</p>{:else}<span>server</span>{/if}
</svelte:element>
<p>after</p>
