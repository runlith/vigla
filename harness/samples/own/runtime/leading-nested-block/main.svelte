<script>
	let outer = $state(true);
	let inner = $state(true);
	let rows = $state([
		{ id: 1, on: true },
		{ id: 2, on: true }
	]);
</script>

<button onclick={() => (inner = !inner)}>inner</button>
<button onclick={() => (outer = !outer)}>outer</button>
<button onclick={() => (rows[0].on = !rows[0].on)}>first</button>
<button onclick={() => (rows = [...rows].reverse())}>reverse</button>
{#if outer}
	{#if inner}<b>yes</b>{:else}<i>no</i>{/if}<span>tail</span>
{/if}
<ul>
	{#each rows as row (row.id)}
		{#if row.on}<b>{row.id}</b>{:else}<i>{row.id}</i>{/if}
	{/each}
</ul>
