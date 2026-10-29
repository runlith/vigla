<script>
	let { grip } = $props();
	let measured = $state(0);

	$effect(() => {
		measured = grip.size;
	});
</script>

<b>{measured}</b>
