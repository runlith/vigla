<script>
	let { host, rows } = $props();
</script>

<aside>
	{#each rows as row (row.id)}
		<a>{row.title} · {host.name}</a>
	{/each}
</aside>
