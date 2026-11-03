<script>
	const words = [
		'async',
		'context',
		'hydration',
		'kit',
		'owner',
		'runes',
		'scheduler',
		'server',
		'signal',
		'svelte',
		'vigla',
		'vite'
	];

	let query = $state('s');

	async function search(term) {
		await new Promise((resolve) => setTimeout(resolve, 400));
		return words.filter((word) => word.includes(term.toLowerCase()));
	}
</script>

<input bind:value={query} placeholder="search" />

<svelte:boundary>
	<p class="muted">{$effect.pending() ? 'searching…' : 'idle'}</p>
	<ul>
		{#each await search(query) as word (word)}
			<li>{word}</li>
		{:else}
			<li class="muted">nothing</li>
		{/each}
	</ul>

	{#snippet pending()}
		<p class="muted">first search…</p>
	{/snippet}
</svelte:boundary>
