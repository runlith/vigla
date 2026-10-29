<script>
	let { item, count } = $props();

	$effect.pre(() => {
		console.log(`pre ${item.name} ${count}`);
	});

	$effect(() => {
		console.log(`effect ${item.name} ${count}`);
	});
</script>

<p>{item.name} {count}</p>
