<script>
	let entries = $state([{selected: 'a'}])
</script>

{#each entries as entry}
	{entry.selected} <select bind:value={entry.selected}></select>
{/each}

<button
	onclick={
		() => entries = [{selected: 'a'}, {selected: 'b'}]
	}
	>change</button>
