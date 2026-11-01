<script>
	let show = $state(false);
	let input = $state();
	$effect(() => {
		if (show && input) input.focus();
	});
</script>

<button onmousedown={event => event.preventDefault()} onclick={() => show = true}>show</button>
{#if show}
	<input bind:this={input} />
{/if}
