<script>
	class Counter {
		count = $state(0);

		#count = $state(0);

		increment = () => this.#count += 1;

		get secretCount() {
			return this.#count;
		}
	}
	const counter = new Counter();
</script>

<button onclick={() => counter.count++}>{counter.count}</button>
<button onclick={counter.increment}>{counter.secretCount}</button>
