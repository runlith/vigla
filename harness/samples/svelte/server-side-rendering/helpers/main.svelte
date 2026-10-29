<script>
	let { foo = 1 } = $props();

	const thrice = num => 3 * num;
</script>

<p>{thrice(foo)}</p>
