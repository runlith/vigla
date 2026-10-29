<script>
	let { things } = $props();
</script>

<ul>
	{#each things.foo as foo}
		<li>{foo}</li>
	{/each}
</ul>