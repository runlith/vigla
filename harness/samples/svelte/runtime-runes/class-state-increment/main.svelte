<script>
	class Counter {
		count = $state(1);
	}
	const counter = new Counter();
</script>

<button onclick={() => counter.count *= 2}>{counter.count}</button>
