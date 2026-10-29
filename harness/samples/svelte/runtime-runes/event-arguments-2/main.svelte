<script>
	let count = $state(0);
	function increment(...args) {
			count += args.length;
	}
</script>

<button onclick={increment}>{count}</button>
