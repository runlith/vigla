<script>
	import Child from './Child.svelte';
	let shown = $state(true);
</script>

<button onclick={() => shown = false}>dispose</button>
{#if shown}
	<Child id={1} />
	<Child id={2} />
{/if}
