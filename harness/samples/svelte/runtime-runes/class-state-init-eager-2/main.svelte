<script>
	const logger = (obj) => {
		console.log(obj.count)
	}

	class Counter {
		count = $state();
		#count;

		constructor(initial_count) {
			logger(this);
			this.count = initial_count;
		}
	}
	const counter = new Counter(0);
</script>

<button onclick={() => counter.count++}>{counter.count}</button>
