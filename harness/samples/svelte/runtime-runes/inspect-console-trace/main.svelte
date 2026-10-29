<script>
	let x = $state(0);
	let y = $state(0);

	$inspect(x).with((type, x) => {
		if (type === 'update') console.log(new Error(), x);
	});
</script>

<button onclick={() => x++}>{x}</button>
<button onclick={() => y++}>{y}</button>
