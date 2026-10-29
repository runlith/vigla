<script>
	class Counter {
		count = $state();
		#count;

		constructor(initial_count) {
			console.log(this.count)
			this.count = initial_count;
		}
	}
	const counter = new Counter(0);
</script>

<button onclick={() => counter.count++}>{counter.count}</button>
