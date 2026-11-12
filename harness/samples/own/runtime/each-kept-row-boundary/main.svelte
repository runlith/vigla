<script>
	import Counter from './Counter.svelte';

	let rows = $state([]);
</script>

<button class="add" onclick={() => rows.push(rows.length)}>add</button>
{#each rows as row (row)}
	<svelte:boundary onerror={(error) => console.log(`reported ${error.message}`)}>
		<Counter id={row} />
		{#snippet failed(error)}
			<p>{error.message}</p>
		{/snippet}
	</svelte:boundary>
{/each}
