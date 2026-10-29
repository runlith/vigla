<script>
	let count = $state(0);
	function increment() {
			count += arguments.length;
	}
</script>

<button onclick={increment}>{count}</button>
