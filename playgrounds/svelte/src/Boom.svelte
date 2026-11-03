<script>
	let exploded = $state(false);

	function explode() {
		throw new Error('boom');
	}
</script>

<button onclick={() => (exploded = true)}>throw</button>
{#if exploded}
	{explode()}
{/if}
