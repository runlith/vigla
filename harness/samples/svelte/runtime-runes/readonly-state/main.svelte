<script>
	let x = $state.raw(0);
	let y = $state.raw(0);

	$effect(() => {
		console.log(x);
	});
</script>

<button onclick={() => x++}>{x}</button>
<button onclick={() => y++}>{y}</button>
