<script>
	import Child from './Child.svelte';
	let expanded = $state(false);
	$effect(() => console.log(`post:${expanded}`));
	$effect.pre(() => console.log(`pre:${expanded}`));
</script>

{#if expanded}
	<input onblur={() => expanded = false} />
	<Child />
{:else}
	<button onclick={() => expanded = true}>expand</button>
{/if}
