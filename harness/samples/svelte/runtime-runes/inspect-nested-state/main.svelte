<script>
	let x = $state({count: 0});

	$inspect({x}, [x]);
</script>

<button onclick={() => x.count++}>{x.count}</button>
