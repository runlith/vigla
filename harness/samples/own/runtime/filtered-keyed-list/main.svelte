<script>
	let items = $state([
		{ id: 1, text: 'one', done: false },
		{ id: 2, text: 'two', done: true },
		{ id: 3, text: 'three', done: false }
	]);
	let hideDone = $state(false);
	let shown = $derived(hideDone ? items.filter((item) => !item.done) : items);
	let left = $derived(items.filter((item) => !item.done).length);
</script>

<button onclick={() => (hideDone = !hideDone)}>filter</button>
<button onclick={() => (items = [...items].reverse())}>reverse</button>
{#if left > 0}
	<p>{left} left</p>
{:else}
	<p>all done</p>
{/if}
<ul>
	{#each shown as item (item.id)}
		<li><button onclick={() => (item.done = !item.done)}>{item.text}</button></li>
	{/each}
</ul>
