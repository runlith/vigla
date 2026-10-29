<script>
	let x = $state(0);
	let y = $state(0);

	$effect(() => {
		console.log(x);
	});
</script>

<button onclick={() => x++}>{x}</button>
<button onclick={() => y++}>{y}</button>
