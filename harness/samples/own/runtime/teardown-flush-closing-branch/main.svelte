<script>
	import Branch from './Branch.svelte';

	let open = $state(true);
	let closing = $state(false);
	let ticks = $state(0);

	$effect(() => {
		if (closing) open = false;
	});

	$effect(() => {
		console.log(ticks);
	});
</script>

<button onclick={() => (closing = true)}>close</button>
{#if open}
	<Branch onclose={() => (ticks += 1)} />
{/if}
