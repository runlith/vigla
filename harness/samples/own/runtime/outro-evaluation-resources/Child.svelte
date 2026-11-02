<script>
	let { read, register } = $props();
	let selected = $derived(read());
	register(() => selected);

	function leave(node, value) {
		node.dataset.value = value.value;
		return { duration: 100 };
	}
</script>

<p out:leave={selected}>outgoing</p>
