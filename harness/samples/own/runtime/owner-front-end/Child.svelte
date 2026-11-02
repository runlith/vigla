<script>
	let { tag } = $props();
</script>

{#if tag}
	<svelte:element this={tag}></svelte:element>
{:else}
	<select multiple value={1}></select>
{/if}
