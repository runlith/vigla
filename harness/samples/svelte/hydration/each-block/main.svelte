<script>
	let { things } = $props();
</script>

<ul>
	{#each things as thing}
		<li>{thing}</li>
	{/each}
</ul>