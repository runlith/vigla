<script>
	let { value } = $props();

	$effect(() => {
		$inspect.trace('row');
		value;
	});
</script>

<p>{value}</p>
