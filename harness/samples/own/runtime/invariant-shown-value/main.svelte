<script>
	let a = $state(0);
	let b = $state(0);
	let resolve = () => {};
	const gate = new Promise((done) => {
		resolve = done;
	});

	$effect(() => {
		console.log(`${a} ${b}`);
	});
</script>

<button onclick={() => (a = 1)}>a</button>
<button onclick={() => (b = 1)}>b</button>
<button onclick={() => resolve('done')}>resolve</button>
<p>{a} {b}</p>
{#if a > 0}
	<svelte:boundary>
		{#snippet pending()}<i>loading</i>{/snippet}
		<b>{await gate}</b>
	</svelte:boundary>
{/if}
