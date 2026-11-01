<script>
	let { word = null } = $props();
</script>

{#if word}
	{@const match = word.match(/\w+/)}
	<p>{match ? match[0] : word}</p>
{/if}
