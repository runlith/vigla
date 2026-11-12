<script>
	let { id } = $props();
	let count = $state(0);

	console.log(`built ${id}`);

	$effect(() => {
		if (id === 1) throw new Error(`row ${id} failed`);
	});
</script>

<button class="count" onclick={() => count++}>{id}: {count}</button>
