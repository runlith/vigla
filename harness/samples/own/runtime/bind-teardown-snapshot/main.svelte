<script>
	let input = $state(null);
	let show = $state(true);

	$effect(() => {
		input;
		return () => console.log(input?.tagName ?? null);
	});
</script>

<button onclick={() => show = !show}>toggle</button>
{#if show}
	<input bind:this={input} />
{/if}
