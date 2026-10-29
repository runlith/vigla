<script>
	class Counter {
		count = $state(0);

		constructor() {
			$effect(() => {
				this.count = 10;
			});
		}
	}
	const counter = new Counter();
</script>

<button onclick={() => counter.count++}>{counter.count}</button>
