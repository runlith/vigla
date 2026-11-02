<script>
	let { value } = $props();
	let selected = $derived(value);

	function leave(node, last) {
		node.dataset.value = last;
		return { duration: 100 };
	}
</script>

<i out:leave={selected}>{selected}</i>
