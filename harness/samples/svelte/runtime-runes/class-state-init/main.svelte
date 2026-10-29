<script>
	class Counter {
		count = $state(0);

		constructor(initial_count) {
			this.count = initial_count;
		}
	}
	const counter = new Counter(0);
</script>

<button onclick={() => counter.count++}>{counter.count}</button>
