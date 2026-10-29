<script>
	let items = $state.raw([0]);

	const addItem = () => {
		items = [...items, items.length];
	};
</script>

<button onclick={addItem}>
	{items.join(', ')}
</button>
