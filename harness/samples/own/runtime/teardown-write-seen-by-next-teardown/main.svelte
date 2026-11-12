<script>
	import Part from './Part.svelte';
	let shown = $state(true);
	let parts = $state.raw([]);
	const registry = {
		add(name) {
			parts = [...parts, name];
			return () => {
				parts = parts.filter((one) => one !== name);
			};
		}
	};
</script>

<button onclick={() => (shown = false)}>hide</button>
<p>{parts.join(',')}</p>
{#if shown}
	{#each ['a', 'b', 'c'] as name (name)}
		<Part {name} {registry} />
	{/each}
{/if}
