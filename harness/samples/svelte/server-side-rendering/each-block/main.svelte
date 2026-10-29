<script>
	let { animals } = $props();
</script>

{#each animals as animal, i}
	<p>{i + 1}: {animal}</p>
{/each}
