<script>
	let x = $state(0);
	let y = $state(0);

	$effect.pre(() => {
		console.log('first'+x);
	});

	$effect(() => {
		console.log('second'+x);
	});
</script>

<button onclick={() => x++}>{x}</button>
<button onclick={() => y++}>{y}</button>
