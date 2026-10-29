<script>
	class Counter {
		count = $state();

		constructor(v) {
			this.count = v;
		}
	}
	const counter = new Counter({ count: 0 });
</script>

<button onclick={() => counter.count.count++}>{counter.count.count}</button>
